from sentence_transformers import SentenceTransformer
from src.api.schemas import EmbeddingResponse
from src.config import settings
from src.utils.logger import setup_logger
import numpy as np
import torch

logger = setup_logger()

# Global model instance (lazy loading)
_embedding_model = None
_device = None

def get_device():
    """Get device (CPU or CUDA) with fallback to CPU"""
    global _device
    if _device is None:
        # Try CUDA, but fallback to CPU if unavailable or busy
        if torch.cuda.is_available():
            try:
                # Test if CUDA is actually usable
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

def get_embedding_model(model_name: str = None):
    """Get or load embedding model"""
    global _embedding_model
    model_name = model_name or settings.EMBEDDING_MODEL
    
    if _embedding_model is None or _embedding_model.get_sentence_embedding_dimension() != model_name:
        logger.info(f"Loading embedding model: {model_name}")
        device = get_device()
        
        try:
            # Load model with explicit device
            _embedding_model = SentenceTransformer(model_name, device=device)
            logger.info(f"Embedding model loaded: {model_name} on {device}")
        except Exception as e:
            # If CUDA fails, retry with CPU
            if device == 'cuda':
                logger.warning(f"Failed to load model on CUDA: {e}. Retrying with CPU")
                _embedding_model = SentenceTransformer(model_name, device='cpu')
                _device = 'cpu'
                logger.info(f"Embedding model loaded: {model_name} on CPU (fallback)")
            else:
                raise
    
    return _embedding_model

async def generate_embedding(text: str, model: str = None) -> EmbeddingResponse:
    """Generate embedding for text"""
    try:
        model_name = model or settings.EMBEDDING_MODEL
        embedding_model = get_embedding_model(model_name)
        
        # Generate embedding with error handling
        try:
            embedding = embedding_model.encode(text, convert_to_numpy=True, device=get_device())
        except Exception as e:
            # If CUDA fails, retry with CPU
            if 'cuda' in str(e).lower() or 'CUDA' in str(e):
                logger.warning(f"CUDA error during encoding: {e}. Retrying with CPU")
                # Force CPU mode
                _device = 'cpu'
                embedding = embedding_model.encode(text, convert_to_numpy=True, device='cpu')
            else:
                raise
        
        # Convert to list
        embedding_list = embedding.tolist()
        
        return EmbeddingResponse(
            embedding=embedding_list,
            model=model_name,
            dimension=len(embedding_list)
        )
    except Exception as e:
        logger.error(f"Error generating embedding: {e}")
        raise