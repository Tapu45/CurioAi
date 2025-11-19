"""
Enhanced Embedding Service with tier-based model selection
Uses existing MODEL_TIERS configuration
"""
from sentence_transformers import SentenceTransformer
from src.api.schemas import EmbeddingResponse
from src.config import settings
from src.services.model_manager import get_model_manager
from src.utils.logger import setup_logger
import numpy as np
import torch
from typing import List, Optional

logger = setup_logger()

# Global model instances (lazy loading)
_embedding_models = {}  # Cache models by name
_device = None

def get_device():
    """Get device (CPU or CUDA) with fallback to CPU"""
    global _device
    if _device is None:
        if torch.cuda.is_available():
            try:
                test_tensor = torch.zeros(1).cuda()
                _device = 'cuda'
                logger.info("Using CUDA for embeddings")
            except Exception as e:
                logger.warning(f"CUDA available but not usable: {e}. Falling back to CPU")
                _device = 'cpu'
        else:
            _device = 'cpu'
            logger.info("Using CPU for embeddings (CUDA not available)")
    return _device

def get_embedding_model_for_tier(tier: Optional[str] = None):
    """Get embedding model based on system tier"""
    model_manager = get_model_manager()
    
    # Get tier if not provided
    if not tier:
        tier = model_manager.get_recommended_tier() if not settings.MODEL_TIER else settings.MODEL_TIER
    
    # Get model name for tier
    tier_config = model_manager._get_models_for_tier(tier)
    model_name = tier_config.get('embedding', 'all-MiniLM-L6-v2')
    
    return get_embedding_model(model_name)

def get_embedding_model(model_name: str = None):
    """Get or load embedding model"""
    model_name = model_name or settings.EMBEDDING_MODEL
    
    # Check cache
    if model_name in _embedding_models:
        return _embedding_models[model_name]
    
    logger.info(f"Loading embedding model: {model_name}")
    device = get_device()
    
    try:
        model = SentenceTransformer(model_name, device=device)
        _embedding_models[model_name] = model
        logger.info(f"Embedding model loaded: {model_name} on {device}")
        return model
    except Exception as e:
        if device == 'cuda':
            logger.warning(f"Failed to load model on CUDA: {e}. Retrying with CPU")
            model = SentenceTransformer(model_name, device='cpu')
            _device = 'cpu'
            _embedding_models[model_name] = model
            logger.info(f"Embedding model loaded: {model_name} on CPU (fallback)")
            return model
        else:
            raise

async def generate_embedding(text: str, model: str = None, tier: Optional[str] = None) -> EmbeddingResponse:
    """Generate embedding for text with tier-based model selection"""
    try:
        # Use tier-based model if tier provided, otherwise use specified model or default
        if tier:
            embedding_model = get_embedding_model_for_tier(tier)
        else:
            model_name = model or settings.EMBEDDING_MODEL
            embedding_model = get_embedding_model(model_name)
        
        # Generate embedding
        try:
            embedding = embedding_model.encode(text, convert_to_numpy=True, device=get_device())
        except Exception as e:
            if 'cuda' in str(e).lower() or 'CUDA' in str(e):
                logger.warning(f"CUDA error during encoding: {e}. Retrying with CPU")
                _device = 'cpu'
                embedding = embedding_model.encode(text, convert_to_numpy=True, device='cpu')
            else:
                raise
        
        embedding_list = embedding.tolist()
        
        return EmbeddingResponse(
            embedding=embedding_list,
            model=embedding_model.get_sentence_embedding_dimension(),
            dimension=len(embedding_list)
        )
    except Exception as e:
        logger.error(f"Error generating embedding: {e}")
        raise

async def batch_generate_embeddings(texts: List[str], model: str = None, tier: Optional[str] = None) -> List[EmbeddingResponse]:
    """Generate embeddings for multiple texts in batch (more efficient)"""
    try:
        # Use tier-based model if tier provided
        if tier:
            embedding_model = get_embedding_model_for_tier(tier)
        else:
            model_name = model or settings.EMBEDDING_MODEL
            embedding_model = get_embedding_model(model_name)
        
        # Batch encode (more efficient than individual encodes)
        try:
            embeddings = embedding_model.encode(
                texts,
                convert_to_numpy=True,
                device=get_device(),
                batch_size=32,  # Process in batches
                show_progress_bar=False,
            )
        except Exception as e:
            if 'cuda' in str(e).lower() or 'CUDA' in str(e):
                logger.warning(f"CUDA error during batch encoding: {e}. Retrying with CPU")
                _device = 'cpu'
                embeddings = embedding_model.encode(
                    texts,
                    convert_to_numpy=True,
                    device='cpu',
                    batch_size=32,
                    show_progress_bar=False,
                )
            else:
                raise
        
        # Convert to list of EmbeddingResponse
        results = []
        for i, embedding in enumerate(embeddings):
            results.append(EmbeddingResponse(
                embedding=embedding.tolist(),
                model=embedding_model.get_sentence_embedding_dimension(),
                dimension=len(embedding)
            ))
        
        logger.info(f"Generated {len(results)} embeddings in batch")
        return results
    except Exception as e:
        logger.error(f"Error generating batch embeddings: {e}")
        raise

def get_model_dimension(model_name: str = None) -> int:
    """Get embedding dimension for a model"""
    model_name = model_name or settings.EMBEDDING_MODEL
    model = get_embedding_model(model_name)
    return model.get_sentence_embedding_dimension()

def clear_model_cache():
    """Clear cached models (useful for memory management)"""
    global _embedding_models
    _embedding_models.clear()
    logger.info("Embedding model cache cleared")