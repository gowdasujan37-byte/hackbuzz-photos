from fastapi import APIRouter, HTTPException, Query, Depends
from typing import Optional
import logging

from dependencies import require_admin
from database import get_stats, get_photos, delete_photo, toggle_photo_visibility
from cloudinary_service import delete_image

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/stats")
async def get_dashboard_stats():
    """Get system statistics for admin dashboard."""
    stats = await get_stats()
    return stats


@router.get("/photos")
async def list_photos(
    event_id: Optional[int] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0)
):
    """List all uploaded photos with optional event filter."""
    photos = await get_photos(event_id=event_id, limit=limit, offset=offset)
    return {"photos": photos, "count": len(photos)}


@router.delete("/photo/{photo_id}", dependencies=[Depends(require_admin)])
async def remove_photo(photo_id: int, public_id: Optional[str] = None):
    """Delete a photo from database and optionally from Cloudinary."""
    deleted = await delete_photo(photo_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Photo not found")

    cloudinary_deleted = False
    if public_id:
        cloudinary_deleted = delete_image(public_id)

    return {
        "deleted": True,
        "photo_id": photo_id,
        "cloudinary_deleted": cloudinary_deleted
    }


@router.put("/photo/{photo_id}/visibility", dependencies=[Depends(require_admin)])
async def toggle_photo_visibility_endpoint(photo_id: int):
    """Toggle photo visibility (hide/unhide) for admin."""
    is_hidden = await toggle_photo_visibility(photo_id)
    return {
        "photo_id": photo_id,
        "is_hidden": is_hidden,
        "status": "hidden" if is_hidden else "visible"
    }
