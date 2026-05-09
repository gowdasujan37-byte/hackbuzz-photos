import cloudinary
import cloudinary.uploader
import cloudinary.api
import os
from typing import Optional, Dict
import logging

logger = logging.getLogger(__name__)


def configure_cloudinary():
    """Configure Cloudinary with environment variables."""
    cloudinary.config(
        cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
        api_key=os.getenv("CLOUDINARY_API_KEY"),
        api_secret=os.getenv("CLOUDINARY_API_SECRET"),
        secure=True
    )


def upload_image(
    file_bytes: bytes,
    filename: str,
    event_folder: str = "facevent/events",
    public_id: Optional[str] = None
) -> Optional[Dict]:
    """
    Upload image to Cloudinary.
    Returns dict with url, public_id, width, height or None on failure.
    """
    configure_cloudinary()
    try:
        options = {
            "folder": event_folder,
            "resource_type": "image",
            "quality": "auto:good",
            "fetch_format": "auto",
        }
        if public_id:
            options["public_id"] = public_id

        result = cloudinary.uploader.upload(file_bytes, **options)
        return {
            "url": result["secure_url"],
            "public_id": result["public_id"],
            "width": result.get("width"),
            "height": result.get("height"),
            "format": result.get("format"),
            "bytes": result.get("bytes")
        }
    except Exception as e:
        logger.error(f"Cloudinary upload error for {filename}: {e}")
        return None


def delete_image(public_id: str) -> bool:
    """Delete an image from Cloudinary."""
    configure_cloudinary()
    try:
        result = cloudinary.uploader.destroy(public_id)
        return result.get("result") == "ok"
    except Exception as e:
        logger.error(f"Cloudinary delete error for {public_id}: {e}")
        return False


def get_optimized_url(public_id: str, width: int = 800) -> str:
    """Get an optimized/resized Cloudinary URL."""
    configure_cloudinary()
    return cloudinary.CloudinaryImage(public_id).build_url(
        width=width,
        crop="limit",
        quality="auto",
        fetch_format="auto"
    )


def get_thumbnail_url(public_id: str, width: int = 300, height: int = 300) -> str:
    """Get a thumbnail Cloudinary URL."""
    configure_cloudinary()
    return cloudinary.CloudinaryImage(public_id).build_url(
        width=width,
        height=height,
        crop="fill",
        gravity="face",
        quality="auto",
        fetch_format="auto"
    )
