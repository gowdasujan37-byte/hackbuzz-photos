from fastapi import APIRouter, UploadFile, File, HTTPException, BackgroundTasks, Form, Depends, Query
from typing import List, Optional
import logging

from dependencies import require_admin
from database import (
    insert_photo, insert_face_embedding, update_photo_processed,
    insert_event, get_events, check_duplicate_filenames, get_public_photos, get_public_photos_count
)
from cloudinary_service import upload_image
try:
    from face_service import detect_faces_and_embeddings
except Exception as e:
    print("Face recognition disabled:", e)

    async def detect_faces_and_embeddings(*args, **kwargs):
        return []

router = APIRouter()
logger = logging.getLogger(__name__)

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/jpg", "image/webp", "image/gif"}
MAX_FILE_SIZE = 20 * 1024 * 1024  # 20MB


async def process_photo_background(
    photo_id: int,
    cloudinary_url: str,
    image_bytes: bytes
):
    """Background task: detect faces and store embeddings with quality scoring."""
    try:
        faces = detect_faces_and_embeddings(
            image_bytes,
            use_preprocessing=True,
            use_multi_scale=True,
            min_quality=0.7
        )
        face_count = len(faces)
        
        # Store embeddings with quality information
        for embedding, location, quality in faces:
            await insert_face_embedding(photo_id, embedding, list(location))
            logger.debug(f"Face stored with quality score: {quality:.2f}")
        
        await update_photo_processed(photo_id, face_count)
        logger.info(f"Photo {photo_id}: {face_count} high-quality faces processed")
    except Exception as e:
        logger.error(f"Error processing photo {photo_id}: {e}", exc_info=True)
        await update_photo_processed(photo_id, 0)


@router.post("/check-duplicates", dependencies=[Depends(require_admin)])
async def check_duplicates(
    filenames: List[str],
    event_id: Optional[int] = None
):
    """
    Given a list of filenames, return which ones already exist in the DB.
    Frontend calls this right after the admin selects files, before uploading.
    """
    duplicates = await check_duplicate_filenames(filenames, event_id)
    return {
        "duplicates": duplicates,
        "duplicate_count": len(duplicates),
        "total_checked": len(filenames),
    }


@router.post("/photos", dependencies=[Depends(require_admin)])
async def upload_photos(
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
    event_id: int = Form(1),
    event_folder: str = Form("facevent/events"),
    skip_duplicates: bool = Form(True),   # if True, silently skip dupes; if False, re-upload
):
    """
    Bulk upload photos for an event.
    - Checks filenames against DB before uploading to Cloudinary.
    - skip_duplicates=True  → duplicate files are reported but not re-uploaded.
    - skip_duplicates=False → duplicate files are uploaded again (new Cloudinary entry).
    """
    if not files:
        raise HTTPException(status_code=400, detail="No files provided")

    # ── 1. Fast duplicate pre-check (filename only, no I/O cost) ──────────────
    all_names = [f.filename for f in files]
    duplicate_map = await check_duplicate_filenames(all_names, event_id)

    results = []
    errors = []
    skipped = []

    for file in files:
        # ── 2. Validate type ───────────────────────────────────────────────────
        if file.content_type not in ALLOWED_TYPES:
            errors.append({"filename": file.filename, "error": "Invalid file type"})
            continue

        # ── 3. Handle duplicate ────────────────────────────────────────────────
        if file.filename in duplicate_map and skip_duplicates:
            existing = duplicate_map[file.filename]
            skipped.append({
                "filename": file.filename,
                "existing_url": existing["cloudinary_url"],
                "event_name": existing["event_name"],
                "uploaded_at": existing["created_at"],
            })
            continue

        try:
            content = await file.read()

            if len(content) > MAX_FILE_SIZE:
                errors.append({"filename": file.filename, "error": "File too large (max 20MB)"})
                continue

            # ── 4. Upload to Cloudinary ────────────────────────────────────────
            upload_result = upload_image(content, file.filename, event_folder)
            if not upload_result:
                errors.append({"filename": file.filename, "error": "Cloudinary upload failed"})
                continue

            # ── 5. Store in DB ─────────────────────────────────────────────────
            photo_id = await insert_photo(
                event_id=event_id,
                cloudinary_url=upload_result["url"],
                cloudinary_public_id=upload_result["public_id"],
                original_filename=file.filename
            )

            if photo_id == -1:
                errors.append({"filename": file.filename, "error": "Duplicate public_id, skipped"})
                continue

            # ── 6. Queue face processing ───────────────────────────────────────
            background_tasks.add_task(
                process_photo_background,
                photo_id,
                upload_result["url"],
                content
            )

            results.append({
                "filename": file.filename,
                "photo_id": photo_id,
                "url": upload_result["url"],
                "public_id": upload_result["public_id"],
                "status": "uploaded_processing",
            })

        except Exception as e:
            logger.error(f"Upload error for {file.filename}: {e}")
            errors.append({"filename": file.filename, "error": str(e)})

    return {
        "success": len(results),
        "skipped": len(skipped),
        "errors": len(errors),
        "results": results,
        "skipped_details": skipped,
        "error_details": errors,
    }


@router.post("/event", dependencies=[Depends(require_admin)])
async def create_event(name: str = Form(...), description: str = Form("")):
    """Create a new event."""
    event_id = await insert_event(name, description)
    return {"event_id": event_id, "name": name, "description": description}


@router.get("/events")
async def list_events():
    """List all events."""
    events = await get_events()
    return {"events": events}


@router.get("/public/photos")
async def get_public_event_photos(limit: int = Query(50, le=200), offset: int = Query(0)):
    """Get public non-hidden photos for homepage gallery."""
    try:
        logger.info(f"Fetching public photos: limit={limit}, offset={offset}")
        photos = await get_public_photos(limit=limit, offset=offset)
        total = await get_public_photos_count()
        logger.info(f"Retrieved {len(photos)} photos, total available: {total}")
        return {
            "photos": photos,
            "count": len(photos),
            "total": total,
            "has_more": offset + limit < total
        }
    except Exception as e:
        logger.error(f"Error fetching public photos: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch photos: {str(e)}"
        )