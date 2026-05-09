from fastapi import APIRouter, UploadFile, File, HTTPException
from typing import Optional
import logging

from database import get_all_embeddings
from face_service import get_single_face_embedding, compare_embeddings

router = APIRouter()
logger = logging.getLogger(__name__)

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/jpg", "image/webp"}


@router.post("/face")
async def search_by_face(
    file: UploadFile = File(...),
    tolerance: float = 0.5
):
    """
    Student uploads a selfie to find all their event photos.
    
    Steps:
    1. Extract face embedding from uploaded selfie
    2. Compare against all stored embeddings
    3. Return matching photo URLs
    """
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail="Invalid file type. Use JPEG or PNG.")

    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Selfie too large. Max 10MB.")

    # Step 1: Get face embedding from selfie
    embedding = get_single_face_embedding(content)
    if embedding is None:
        raise HTTPException(
            status_code=422,
            detail="No face detected in the uploaded image. Please upload a clear selfie with your face visible."
        )

    # Step 2: Get all stored embeddings
    stored = await get_all_embeddings()
    if not stored:
        return {
            "matches": [],
            "total": 0,
            "message": "No photos in database yet."
        }

    # Step 3: Compare
    clamp_tolerance = max(0.3, min(0.7, tolerance))
    matches = compare_embeddings(embedding, stored, tolerance=clamp_tolerance)

    return {
        "matches": matches,
        "total": len(matches),
        "message": f"Found {len(matches)} photo(s) with your face."
    }
