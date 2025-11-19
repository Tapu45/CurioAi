"""
ML-based Activity Classifier using transformers
Tier-based: HIGH_END and PREMIUM use ML, LOW_END/MID_RANGE use rule-based
"""
from typing import Dict, Optional, List
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch
from src.services.model_manager import get_model_manager
from src.config import settings
from src.utils.logger import setup_logger

logger = setup_logger()

# Global model instances (lazy loading)
_classifier_model = None
_classifier_tokenizer = None
_device = None

# Activity type labels
ACTIVITY_TYPES = [
    'coding',
    'reading',
    'watching',
    'gaming',
    'shopping',
    'social',
    'learning',
    'entertainment',
    'work',
    'other',
]

def get_device():
    """Get device (CPU or CUDA) with fallback to CPU"""
    global _device
    if _device is None:
        if torch.cuda.is_available():
            try:
                test_tensor = torch.zeros(1).cuda()
                _device = 'cuda'
                logger.info("Using CUDA for activity classifier")
            except Exception as e:
                logger.warning(f"CUDA available but not usable: {e}. Falling back to CPU")
                _device = 'cpu'
        else:
            _device = 'cpu'
            logger.info("Using CPU for activity classifier (CUDA not available)")
    return _device

def load_classifier_model():
    """Load classifier model based on system tier"""
    global _classifier_model, _classifier_tokenizer
    
    if _classifier_model is not None:
        return _classifier_model, _classifier_tokenizer
    
    model_manager = get_model_manager()
    tier = model_manager.get_recommended_tier() if not settings.MODEL_TIER else settings.MODEL_TIER
    
    # Only use ML classifier for HIGH_END and PREMIUM tiers
    if tier not in ['HIGH_END', 'PREMIUM']:
        logger.info(f"Tier {tier} uses rule-based classifier, not loading ML model")
        return None, None
    
    model_name = "distilbert-base-uncased"
    device = get_device()
    
    try:
        logger.info(f"Loading activity classifier model: {model_name} on {device}")
        
        # Load tokenizer
        _classifier_tokenizer = AutoTokenizer.from_pretrained(model_name)
        
        # For now, we'll use a zero-shot classification approach
        # In production, you'd fine-tune this model on labeled activity data
        # Using a zero-shot classifier as a starting point
        from transformers import pipeline
        
        # Create zero-shot classification pipeline
        classifier = pipeline(
            "zero-shot-classification",
            model=model_name,
            device=0 if device == 'cuda' else -1,
        )
        
        _classifier_model = classifier
        logger.info(f"Activity classifier model loaded: {model_name}")
        
        return _classifier_model, _classifier_tokenizer
    except Exception as e:
        logger.error(f"Error loading classifier model: {e}")
        return None, None

def should_use_ml_classifier() -> bool:
    """Determine if ML classifier should be used based on tier"""
    model_manager = get_model_manager()
    tier = model_manager.get_recommended_tier() if not settings.MODEL_TIER else settings.MODEL_TIER
    return tier in ['HIGH_END', 'PREMIUM']

async def classify_activity_ml(
    app_name: str,
    window_title: str,
    url: Optional[str] = None,
    content_snippet: Optional[str] = None,
) -> Dict:
    """
    Classify activity using ML model
    
    Args:
        app_name: Application name
        window_title: Window title
        url: URL (if browser activity)
        content_snippet: Content snippet (optional)
    
    Returns:
        Dict with 'activity_type', 'confidence', 'metadata', 'reason'
    """
    try:
        # Check if we should use ML classifier
        if not should_use_ml_classifier():
            return {
                'activity_type': 'other',
                'confidence': 0.5,
                'metadata': {},
                'reason': 'Tier does not support ML classification, use rule-based',
            }
        
        # Load model if not loaded
        classifier, tokenizer = load_classifier_model()
        
        if classifier is None:
            logger.warning("ML classifier not available, falling back to rule-based")
            return {
                'activity_type': 'other',
                'confidence': 0.5,
                'metadata': {},
                'reason': 'ML model not loaded, use rule-based classifier',
            }
        
        # Prepare input text
        input_text = f"{app_name} {window_title}"
        if url:
            input_text += f" {url}"
        if content_snippet:
            # Limit content snippet to first 200 chars
            input_text += f" {content_snippet[:200]}"
        
        # Classify using zero-shot classification
        result = classifier(input_text, ACTIVITY_TYPES)
        
        # Extract top prediction
        if result and 'labels' in result and 'scores' in result:
            top_label = result['labels'][0]
            top_score = result['scores'][0]
            
            # Map to our activity types
            activity_type = map_to_activity_type(top_label)
            
            return {
                'activity_type': activity_type,
                'confidence': float(top_score),
                'metadata': {
                    'all_predictions': {
                        label: float(score)
                        for label, score in zip(result['labels'], result['scores'])
                    },
                    'model': 'distilbert-base-uncased',
                    'method': 'zero-shot-classification',
                },
                'reason': f'ML classification: {top_label} (confidence: {top_score:.2f})',
            }
        else:
            return {
                'activity_type': 'other',
                'confidence': 0.5,
                'metadata': {},
                'reason': 'ML classification returned unexpected format',
            }
    
    except Exception as e:
        logger.error(f"Error in ML activity classification: {e}")
        return {
            'activity_type': 'other',
            'confidence': 0.5,
            'metadata': {'error': str(e)},
            'reason': f'ML classification error: {str(e)}',
        }

def map_to_activity_type(label: str) -> str:
    """Map classifier label to our activity type"""
    # Direct mapping
    if label in ACTIVITY_TYPES:
        return label
    
    # Fallback mappings
    mappings = {
        'code': 'coding',
        'programming': 'coding',
        'editor': 'coding',
        'read': 'reading',
        'book': 'reading',
        'pdf': 'reading',
        'video': 'watching',
        'youtube': 'watching',
        'stream': 'watching',
        'game': 'gaming',
        'play': 'gaming',
        'shop': 'shopping',
        'buy': 'shopping',
        'ecommerce': 'shopping',
        'social': 'social',
        'media': 'social',
        'learn': 'learning',
        'study': 'learning',
        'tutorial': 'learning',
        'entertain': 'entertainment',
        'movie': 'entertainment',
        'music': 'entertainment',
        'work': 'work',
        'office': 'work',
    }
    
    label_lower = label.lower()
    for key, value in mappings.items():
        if key in label_lower:
            return value
    
    return 'other'

async def batch_classify_activities(activities: List[Dict]) -> List[Dict]:
    """Classify multiple activities in batch"""
    results = []
    
    for activity in activities:
        result = await classify_activity_ml(
            app_name=activity.get('app_name', ''),
            window_title=activity.get('window_title', ''),
            url=activity.get('url'),
            content_snippet=activity.get('content_snippet'),
        )
        results.append(result)
    
    return results