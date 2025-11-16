from sentence_transformers import SentenceTransformer
from src.api.schemas import EmbeddingResponse
from src.config import settings
from src.utils.logger import setup_logger
import numpy as np

logger = setup_logger()

# Global model instance (lazy loading)
_embedding_model = None

def get_embedding_model(model_name: str = None):
    """Get or load embedding model"""
    global _embedding_model
    model_name = model_name or settings.EMBEDDING_MODEL
    
    if _embedding_model is None or _embedding_model.get_sentence_embedding_dimension() != model_name:
        logger.info(f"Loading embedding model: {model_name}")
        _embedding_model = SentenceTransformer(model_name)
        logger.info(f"Embedding model loaded: {model_name}")
    
    return _embedding_model

async def generate_embedding(text: str, model: str = None) -> EmbeddingResponse:
    """Generate embedding for text"""
    try:
        model_name = model or settings.EMBEDDING_MODEL
        embedding_model = get_embedding_model(model_name)
        
        # Generate embedding
        embedding = embedding_model.encode(text, convert_to_numpy=True)
        
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