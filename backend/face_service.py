import face_recognition
import numpy as np
import cv2
import io
import requests
from typing import List, Tuple, Optional, Dict
import logging
from collections import defaultdict

logger = logging.getLogger(__name__)

# Face detection settings
MATCH_TOLERANCE = 0.5  # Lower = stricter. 0.6 is default, 0.5 is more strict
MIN_FACE_SIZE = 20  # Minimum face width in pixels
MAX_IMAGE_SIZE = 1920  # Max dimension for face detection
QUALITY_THRESHOLD = 0.7  # Minimum quality score for faces (0-1)


def preprocess_image(image: np.ndarray) -> np.ndarray:
    """
    Preprocess image for better face detection.
    Applies brightness correction, contrast enhancement, and sharpening.
    """
    try:
        # Convert to LAB color space for better preprocessing
        lab = cv2.cvtColor(image, cv2.COLOR_RGB2LAB)
        l, a, b = cv2.split(lab)
        
        # Apply CLAHE (Contrast Limited Adaptive Histogram Equalization)
        clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
        l = clahe.apply(l)
        
        # Merge channels back
        lab = cv2.merge([l, a, b])
        processed = cv2.cvtColor(lab, cv2.COLOR_LAB2RGB)
        
        # Apply slight sharpening
        kernel = np.array([[-1, -1, -1],
                          [-1,  9, -1],
                          [-1, -1, -1]]) / 1.5
        processed = cv2.filter2D(processed, -1, kernel)
        
        # Ensure values are in valid range
        processed = np.clip(processed, 0, 255).astype(np.uint8)
        
        return processed
    except Exception as e:
        logger.warning(f"Preprocessing failed, using original image: {e}")
        return image


def calculate_face_quality(image: np.ndarray, face_location: Tuple) -> float:
    """
    Calculate quality score for a face (0-1).
    Based on face size, position, and image quality in that region.
    """
    try:
        top, right, bottom, left = face_location
        face_width = right - left
        face_height = bottom - top
        
        # Size score (larger faces are usually better)
        size_score = min(face_width / 200, 1.0)
        
        # Position score (faces centered are usually better)
        img_h, img_w = image.shape[:2]
        center_x = (left + right) / 2 / img_w
        center_y = (top + bottom) / 2 / img_h
        position_score = 1.0 - abs(center_x - 0.5) - abs(center_y - 0.5)
        
        # Sharpness score (using Laplacian variance)
        face_region = image[max(0, top-5):min(img_h, bottom+5), 
                           max(0, left-5):min(img_w, right+5)]
        if face_region.size > 0:
            gray = cv2.cvtColor(face_region, cv2.COLOR_RGB2GRAY)
            laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
            sharpness_score = min(laplacian_var / 100, 1.0)
        else:
            sharpness_score = 0.5
        
        # Weighted average
        quality = (size_score * 0.4 + position_score * 0.3 + sharpness_score * 0.3)
        return min(max(quality, 0), 1.0)
    except Exception as e:
        logger.warning(f"Quality calculation failed: {e}")
        return 0.5


def detect_faces_multi_scale(image: np.ndarray, model: str = "hog") -> List[Tuple]:
    """
    Detect faces with multiple scales for better coverage.
    Particularly useful for detecting faces of different sizes.
    """
    faces_by_scale = []
    h, w = image.shape[:2]
    
    # Try different scales
    scales = [1.0, 0.8, 1.2]  # Original, reduced, enlarged
    
    for scale in scales:
        if scale != 1.0:
            scaled_h = int(h * scale)
            scaled_w = int(w * scale)
            scaled_image = cv2.resize(image, (scaled_w, scaled_h))
        else:
            scaled_image = image
        
        try:
            locations = face_recognition.face_locations(scaled_image, model=model)
            
            # Scale back locations to original image size
            for top, right, bottom, left in locations:
                if scale != 1.0:
                    top = int(top / scale)
                    right = int(right / scale)
                    bottom = int(bottom / scale)
                    left = int(left / scale)
                
                faces_by_scale.append((top, right, bottom, left))
        except Exception as e:
            logger.debug(f"Multi-scale detection at scale {scale} failed: {e}")
            continue
    
    return faces_by_scale


def remove_duplicate_faces(face_locations: List[Tuple], tolerance: int = 10) -> List[Tuple]:
    """
    Remove duplicate face detections (overlapping bounding boxes).
    Keeps the one with best quality.
    """
    if not face_locations:
        return []
    
    # Sort by face size (larger first)
    face_locations = sorted(face_locations, 
                           key=lambda x: (x[1]-x[3]) * (x[2]-x[0]), 
                           reverse=True)
    
    kept_faces = []
    for face in face_locations:
        is_duplicate = False
        for kept_face in kept_faces:
            # Check if faces overlap significantly
            top1, right1, bottom1, left1 = face
            top2, right2, bottom2, left2 = kept_face
            
            # Calculate overlap
            x_overlap = max(0, min(right1, right2) - max(left1, left2))
            y_overlap = max(0, min(bottom1, bottom2) - max(top1, top2))
            
            if x_overlap > tolerance and y_overlap > tolerance:
                is_duplicate = True
                break
        
        if not is_duplicate:
            kept_faces.append(face)
    
    return kept_faces


def load_image_from_bytes(image_bytes: bytes) -> Optional[np.ndarray]:
    """Load image from bytes using OpenCV, convert to RGB for face_recognition."""
    try:
        nparr = np.frombuffer(image_bytes, np.uint8)
        img_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img_bgr is None:
            return None
        img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
        return img_rgb
    except Exception as e:
        logger.error(f"Error loading image from bytes: {e}")
        return None


def load_image_from_url(url: str) -> Optional[np.ndarray]:
    """Download and load image from URL."""
    try:
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        return load_image_from_bytes(response.content)
    except Exception as e:
        logger.error(f"Error loading image from URL {url}: {e}")
        return None


def resize_image_if_large(image: np.ndarray, max_dimension: int = MAX_IMAGE_SIZE) -> np.ndarray:
    """Resize large images to speed up face recognition while maintaining quality."""
    h, w = image.shape[:2]
    if max(h, w) > max_dimension:
        scale = max_dimension / max(h, w)
        new_w = int(w * scale)
        new_h = int(h * scale)
        # Use high-quality interpolation
        image = cv2.resize(image, (new_w, new_h), interpolation=cv2.INTER_LANCZOS4)
    return image


def detect_faces_and_embeddings(
    image_bytes: bytes,
    use_preprocessing: bool = True,
    use_multi_scale: bool = True,
    min_quality: float = QUALITY_THRESHOLD,
    model: str = "hog"
) -> List[Tuple[List[float], Tuple, float]]:
    """
    Detect all faces in an image with improved preprocessing and quality scoring.
    Returns list of (embedding, location, quality_score) tuples.
    
    Args:
        image_bytes: Raw image bytes
        use_preprocessing: Apply image preprocessing for better detection
        use_multi_scale: Try multiple scales for better face detection
        min_quality: Minimum quality score to include (0-1)
        model: "hog" (fast) or "cnn" (more accurate, slower)
    """
    image = load_image_from_bytes(image_bytes)
    if image is None:
        logger.error("Failed to load image from bytes")
        return []

    original_image = image.copy()
    image = resize_image_if_large(image)

    try:
        # Apply preprocessing if enabled
        if use_preprocessing:
            image = preprocess_image(image)

        # Detect faces
        if use_multi_scale:
            face_locations = detect_faces_multi_scale(image, model=model)
            # Remove duplicates
            face_locations = remove_duplicate_faces(face_locations)
        else:
            face_locations = face_recognition.face_locations(image, model=model)
        
        if not face_locations:
            logger.debug("No faces detected in image")
            return []

        # Get encodings
        face_encodings = face_recognition.face_encodings(image, face_locations, num_jitters=2)

        results = []
        for encoding, location in zip(face_encodings, face_locations):
            # Calculate quality score
            quality = calculate_face_quality(image, location)
            
            # Only include faces meeting quality threshold
            if quality >= min_quality:
                results.append((encoding.tolist(), location, quality))
            else:
                logger.debug(f"Face filtered due to low quality: {quality:.2f}")

        logger.info(f"Detected {len(results)} valid faces (from {len(face_locations)} total)")
        return results

    except Exception as e:
        logger.error(f"Error detecting faces: {e}", exc_info=True)
        return []


def detect_faces_from_url(
    url: str,
    use_preprocessing: bool = True,
    use_multi_scale: bool = True,
    min_quality: float = QUALITY_THRESHOLD
) -> List[Tuple[List[float], Tuple, float]]:
    """Detect faces from a Cloudinary URL with improved algorithms."""
    image = load_image_from_url(url)
    if image is None:
        logger.error(f"Failed to load image from URL: {url}")
        return []

    image = resize_image_if_large(image)

    try:
        # Apply preprocessing if enabled
        if use_preprocessing:
            image = preprocess_image(image)

        # Detect faces with multi-scale
        if use_multi_scale:
            face_locations = detect_faces_multi_scale(image)
            face_locations = remove_duplicate_faces(face_locations)
        else:
            face_locations = face_recognition.face_locations(image, model="hog")
        
        if not face_locations:
            logger.debug(f"No faces detected from URL: {url}")
            return []

        # Get encodings
        face_encodings = face_recognition.face_encodings(image, face_locations, num_jitters=2)

        results = []
        for encoding, location in zip(face_encodings, face_locations):
            quality = calculate_face_quality(image, location)
            
            if quality >= min_quality:
                results.append((encoding.tolist(), location, quality))

        logger.info(f"Detected {len(results)} valid faces from URL")
        return results

    except Exception as e:
        logger.error(f"Error detecting faces from URL {url}: {e}", exc_info=True)
        return []


def get_single_face_embedding(
    image_bytes: bytes,
    use_preprocessing: bool = True
) -> Optional[List[float]]:
    """
    For student selfie: extract single dominant face embedding.
    Uses improved preprocessing and multi-scale detection.
    Returns None if no face detected.
    """
    image = load_image_from_bytes(image_bytes)
    if image is None:
        logger.error("Failed to load image from bytes for selfie")
        return None

    image = resize_image_if_large(image, max_dimension=800)

    try:
        # Apply preprocessing if enabled
        if use_preprocessing:
            image = preprocess_image(image)

        # Use multi-scale detection for better selfie detection
        face_locations = detect_faces_multi_scale(image, model="hog")
        face_locations = remove_duplicate_faces(face_locations)

        if not face_locations:
            logger.warning("No face detected in uploaded selfie")
            return None

        face_encodings = face_recognition.face_encodings(image, face_locations, num_jitters=2)
        if not face_encodings:
            logger.warning("Could not generate encodings for detected faces")
            return None

        # If multiple faces, pick the one with best quality
        best_idx = 0
        best_quality = -1
        
        if len(face_locations) > 1:
            for i, location in enumerate(face_locations):
                quality = calculate_face_quality(image, location)
                if quality > best_quality:
                    best_quality = quality
                    best_idx = i
            logger.info(f"Multiple faces detected in selfie, using best quality (score: {best_quality:.2f})")
        else:
            best_quality = calculate_face_quality(image, face_locations[0])

        logger.info(f"Extracted selfie embedding with quality: {best_quality:.2f}")
        return face_encodings[best_idx].tolist()

    except Exception as e:
        logger.error(f"Error extracting selfie embedding: {e}", exc_info=True)
        return None


def compare_embeddings(
    query_embedding: List[float],
    stored_embeddings: List[dict],
    tolerance: float = MATCH_TOLERANCE
) -> List[dict]:
    """
    Compare a query embedding against all stored embeddings.
    Returns list of matching records sorted by distance (closest first).
    """
    if not stored_embeddings:
        return []

    query_arr = np.array(query_embedding)
    matches = []

    # Group by photo to avoid duplicate photo results
    seen_photos = {}

    for record in stored_embeddings:
        stored_arr = np.array(record['embedding'])
        distance = np.linalg.norm(query_arr - stored_arr)

        if distance <= tolerance:
            photo_id = record['photo_id']
            # Keep only best match per photo
            if photo_id not in seen_photos or distance < seen_photos[photo_id]['distance']:
                seen_photos[photo_id] = {
                    'photo_id': photo_id,
                    'cloudinary_url': record['cloudinary_url'],
                    'original_filename': record.get('original_filename', ''),
                    'event_name': record.get('event_name', ''),
                    'distance': distance,
                    'confidence': round((1 - distance / tolerance) * 100, 1)
                }

    matches = sorted(seen_photos.values(), key=lambda x: x['distance'])
    return matches
