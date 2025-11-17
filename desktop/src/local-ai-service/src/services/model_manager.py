"""
Model Manager for handling model selection and updates
"""
from typing import Optional, Dict
from src.config import settings
from src.utils.logger import setup_logger
import psutil
import os

logger = setup_logger()

# Model configurations
MODEL_TIERS = {
    "LOW_END": {
        "llm": "phi3:mini",
        "embedding": "all-MiniLM-L6-v2",
        "nlp": "en_core_web_sm",
        "min_ram_gb": 4,
    },
    "MID_RANGE": {
        "llm": "llama3.2:1b",
        "embedding": "all-MiniLM-L6-v2",
        "nlp": "en_core_web_sm",
        "min_ram_gb": 8,
    },
    "HIGH_END": {
        "llm": "llama3.2:3b",
        "embedding": "all-MiniLM-L6-v2",
        "nlp": "en_core_web_sm",
        "min_ram_gb": 16,
    },
    "PREMIUM": {
        "llm": "mistral:7b",
        "embedding": "all-mpnet-base-v2",
        "nlp": "en_core_web_md",
        "min_ram_gb": 16,
    },
}

class ModelManager:
    def __init__(self):
        self.current_tier = settings.MODEL_TIER
        self.current_models = self._get_models_for_tier(self.current_tier) if self.current_tier else None
    
    def _get_models_for_tier(self, tier: Optional[str]) -> Dict:
        """Get model configuration for a tier"""
        if tier and tier in MODEL_TIERS:
            return MODEL_TIERS[tier]
        return MODEL_TIERS["MID_RANGE"]  # Default
    
    def detect_system_resources(self) -> Dict:
        """Detect system resources"""
        try:
            total_ram_gb = psutil.virtual_memory().total / (1024 ** 3)
            free_ram_gb = psutil.virtual_memory().available / (1024 ** 3)
            cpu_count = os.cpu_count() or 1
            
            return {
                "total_ram_gb": round(total_ram_gb, 1),
                "free_ram_gb": round(free_ram_gb, 1),
                "cpu_cores": cpu_count,
            }
        except Exception as e:
            logger.error(f"Error detecting system resources: {e}")
            return {
                "total_ram_gb": 8.0,
                "free_ram_gb": 4.0,
                "cpu_cores": 2,
            }
    
    def get_recommended_tier(self) -> str:
        """Get recommended tier based on system resources"""
        resources = self.detect_system_resources()
        total_ram = resources["total_ram_gb"]
        
        if total_ram >= MODEL_TIERS["PREMIUM"]["min_ram_gb"]:
            return "PREMIUM"
        elif total_ram >= MODEL_TIERS["HIGH_END"]["min_ram_gb"]:
            return "HIGH_END"
        elif total_ram >= MODEL_TIERS["MID_RANGE"]["min_ram_gb"]:
            return "MID_RANGE"
        else:
            return "LOW_END"
    
    def update_models(self, llm_model: Optional[str] = None, 
                     embedding_model: Optional[str] = None,
                     nlp_model: Optional[str] = None) -> Dict:
        """Update current models"""
        try:
            if llm_model:
                settings.OLLAMA_MODEL = llm_model
            if embedding_model:
                settings.EMBEDDING_MODEL = embedding_model
            if nlp_model:
                settings.SPACY_MODEL = nlp_model
            
            logger.info(f"Models updated: LLM={settings.OLLAMA_MODEL}, "
                       f"Embedding={settings.EMBEDDING_MODEL}, "
                       f"NLP={settings.SPACY_MODEL}")
            
            return {
                "success": True,
                "llm_model": settings.OLLAMA_MODEL,
                "embedding_model": settings.EMBEDDING_MODEL,
                "nlp_model": settings.SPACY_MODEL,
            }
        except Exception as e:
            logger.error(f"Error updating models: {e}")
            return {"success": False, "error": str(e)}
    
    def get_current_models(self) -> Dict:
        """Get current model configuration"""
        return {
            "llm_model": settings.OLLAMA_MODEL,
            "embedding_model": settings.EMBEDDING_MODEL,
            "nlp_model": settings.SPACY_MODEL,
            "tier": self.current_tier,
        }
    
    def get_resource_usage(self) -> Dict:
        """Get current resource usage"""
        try:
            memory = psutil.virtual_memory()
            cpu_percent = psutil.cpu_percent(interval=1)
            
            return {
                "ram": {
                    "total_gb": round(memory.total / (1024 ** 3), 1),
                    "used_gb": round(memory.used / (1024 ** 3), 1),
                    "free_gb": round(memory.available / (1024 ** 3), 1),
                    "percent": memory.percent,
                },
                "cpu": {
                    "percent": cpu_percent,
                    "cores": os.cpu_count() or 1,
                },
            }
        except Exception as e:
            logger.error(f"Error getting resource usage: {e}")
            return {}

# Global instance
_model_manager = None

def get_model_manager() -> ModelManager:
    """Get model manager instance"""
    global _model_manager
    if _model_manager is None:
        _model_manager = ModelManager()
    return _model_manager