from typing import Dict, Any
from src.services.vision.ocr_service import extract_text_from_image
from src.services.vision.vision_model import get_vision_model
from src.utils.logger import setup_logger

logger = setup_logger()

async def analyze_image(file_path: str, options: Dict[str, Any] = None) -> Dict[str, Any]:
    """
    Comprehensive image analysis: OCR + Vision model
    
    Args:
        file_path: Path to image file
        options: Analysis options
    
    Returns:
        Dictionary with analysis results
    """
    if options is None:
        options = {}
    
    use_ocr = options.get('use_ocr', True)
    use_vision = options.get('use_vision', True)
    languages = options.get('languages', ['en'])
    
    results = {
        'ocr_text': None,
        'ocr_confidence': None,
        'scene_description': None,
        'objects_detected': [],
        'confidence': 0.0,
        'method': 'combined'
    }
    
    # OCR extraction
    if use_ocr:
        try:
            ocr_result = await extract_text_from_image(file_path, languages)
            results['ocr_text'] = ocr_result.get('text', '')
            results['ocr_confidence'] = ocr_result.get('confidence', 0.0)
            logger.info(f"OCR completed for {file_path}: {len(results['ocr_text'])} characters")
        except Exception as e:
            logger.error(f"OCR failed for {file_path}: {e}")
            results['ocr_error'] = str(e)
    
    # Vision model analysis
    if use_vision:
        try:
            vision_model = get_vision_model()
            vision_result = await vision_model.describe_image(file_path)
            results['scene_description'] = vision_result.get('description', '')
            
            # Detect objects
            objects = await vision_model.detect_objects(file_path)
            results['objects_detected'] = objects
            
            logger.info(f"Vision analysis completed for {file_path}")
        except Exception as e:
            logger.error(f"Vision analysis failed for {file_path}: {e}")
            results['vision_error'] = str(e)
    
    # Calculate overall confidence
    confidences = []
    if results['ocr_confidence']:
        confidences.append(results['ocr_confidence'])
    if results['scene_description']:
        confidences.append(0.8)  # Vision model confidence estimate
    
    results['confidence'] = sum(confidences) / len(confidences) if confidences else 0.0
    
    return results