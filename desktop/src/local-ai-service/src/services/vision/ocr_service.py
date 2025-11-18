import easyocr
from typing import Optional, Dict, Any
from src.utils.logger import setup_logger
import base64
from PIL import Image
import io

logger = setup_logger()

# Global OCR reader instance
_ocr_reader = None

def get_ocr_reader(languages=['en']):
    """Get or initialize EasyOCR reader"""
    global _ocr_reader
    if _ocr_reader is None:
        try:
            logger.info(f"Initializing EasyOCR with languages: {languages}")
            _ocr_reader = easyocr.Reader(languages, gpu=True)  # Use GPU if available
            logger.info("EasyOCR initialized successfully")
        except Exception as e:
            logger.error(f"Error initializing EasyOCR: {e}")
            raise
    return _ocr_reader

async def extract_text_from_image(file_path: str, languages: list = ['en']) -> Dict[str, Any]:
    """
    Extract text from image using EasyOCR
    
    Args:
        file_path: Path to image file
        languages: List of language codes (e.g., ['en', 'hi'])
    
    Returns:
        Dictionary with extracted text and metadata
    """
    try:
        reader = get_ocr_reader(languages)
        
        # Read image
        results = reader.readtext(file_path)
        
        # Extract text and bounding boxes
        text_lines = []
        full_text = []
        confidences = []
        
        for (bbox, text, confidence) in results:
            text_lines.append({
                'text': text,
                'confidence': float(confidence),
                'bbox': bbox
            })
            full_text.append(text)
            confidences.append(float(confidence))
        
        combined_text = ' '.join(full_text)
        avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0
        
        return {
            'text': combined_text,
            'lines': text_lines,
            'confidence': avg_confidence,
            'line_count': len(text_lines),
            'method': 'easyocr'
        }
    except Exception as e:
        logger.error(f"Error extracting text from image {file_path}: {e}")
        raise

async def extract_text_from_image_bytes(image_bytes: bytes, languages: list = ['en']) -> Dict[str, Any]:
    """
    Extract text from image bytes
    
    Args:
        image_bytes: Image file as bytes
        languages: List of language codes
    
    Returns:
        Dictionary with extracted text and metadata
    """
    try:
        reader = get_ocr_reader(languages)
        
        # Convert bytes to PIL Image
        image = Image.open(io.BytesIO(image_bytes))
        
        # Convert to numpy array for EasyOCR
        import numpy as np
        image_array = np.array(image)
        
        results = reader.readtext(image_array)
        
        text_lines = []
        full_text = []
        confidences = []
        
        for (bbox, text, confidence) in results:
            text_lines.append({
                'text': text,
                'confidence': float(confidence),
                'bbox': bbox
            })
            full_text.append(text)
            confidences.append(float(confidence))
        
        combined_text = ' '.join(full_text)
        avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0
        
        return {
            'text': combined_text,
            'lines': text_lines,
            'confidence': avg_confidence,
            'line_count': len(text_lines),
            'method': 'easyocr'
        }
    except Exception as e:
        logger.error(f"Error extracting text from image bytes: {e}")
        raise