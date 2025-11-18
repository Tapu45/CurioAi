from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    # Ollama Configuration
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3.2:1b"  # Default to lightweight model
    
    # Service Configuration
    HOST: str = "127.0.0.1"
    PORT: int = 8000
    LOG_LEVEL: str = "INFO"
    
    # Embedding Model
    EMBEDDING_MODEL: str = "all-MiniLM-L6-v2"
    
    # spaCy Model
    SPACY_MODEL: str = "en_core_web_sm"
    
    # Model Selection (can be overridden via API)
    MODEL_TIER: Optional[str] = None  # LOW_END, MID_RANGE, HIGH_END, PREMIUM

    # LlamaIndex Configuration
    LLAMAINDEX_PERSIST_DIR: Optional[str] = None  # Auto-set in main.py
    LLAMAINDEX_CHUNK_SIZE: int = 1000
    LLAMAINDEX_CHUNK_OVERLAP: int = 200
    
    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()