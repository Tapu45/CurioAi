from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import uvicorn
from dotenv import load_dotenv
import os
from src.services.llamaindex_service import set_index_persist_dir
from src.api.routes import router
from src.config import settings
from src.utils.logger import setup_logger

# Load environment variables
load_dotenv()

# Setup logger
logger = setup_logger()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting CurioAI Local AI Service...")
    logger.info(f"Ollama URL: {settings.OLLAMA_BASE_URL}")
    logger.info(f"Ollama Model: {settings.OLLAMA_MODEL}")
    logger.info(f"Embedding Model: {settings.EMBEDDING_MODEL}")

    persist_dir = os.path.join(os.path.expanduser("~"), ".config", "curioai", "llamaindex")
    set_index_persist_dir(persist_dir)
    logger.info(f"LlamaIndex persist directory: {persist_dir}")
    
    yield
    # Shutdown
    logger.info("Shutting down CurioAI Local AI Service...")

# Create FastAPI app
app = FastAPI(
    title="CurioAI Local AI Service",
    description="Local AI service for summarization, embeddings, and concept extraction",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict this
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routes
app.include_router(router, prefix="/api/v1")

@app.get("/")
async def root():
    return {
        "service": "CurioAI Local AI Service",
        "version": "1.0.0",
        "status": "running"
    }

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=True,
        log_level=settings.LOG_LEVEL.lower()
    )

