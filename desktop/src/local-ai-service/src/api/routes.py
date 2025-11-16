from fastapi import APIRouter, HTTPException
from typing import List

from src.api.schemas import (
    SummarizeRequest,
    SummarizeResponse,
    EmbeddingRequest,
    EmbeddingResponse,
    ExtractConceptsRequest,
    ExtractConceptsResponse,
    ProcessContentRequest,
    ProcessContentResponse,
)
from src.services.summarizer import summarize_content
from src.services.embedding import generate_embedding
from src.services.concept_extractor import extract_concepts
from src.utils.logger import setup_logger

logger = setup_logger()
router = APIRouter()

@router.post("/summarize", response_model=SummarizeResponse)
async def summarize(request: SummarizeRequest):
    """Summarize content using local LLM"""
    try:
        result = await summarize_content(
            request.content,
            max_length=request.max_length,
            include_key_points=request.include_key_points
        )
        return result
    except Exception as e:
        logger.error(f"Error in summarize endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/embedding", response_model=EmbeddingResponse)
async def get_embedding(request: EmbeddingRequest):
    """Generate embedding for text"""
    try:
        result = await generate_embedding(request.text, model=request.model)
        return result
    except Exception as e:
        logger.error(f"Error in embedding endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/concepts", response_model=ExtractConceptsResponse)
async def get_concepts(request: ExtractConceptsRequest):
    """Extract concepts and entities from text"""
    try:
        result = await extract_concepts(request.text, min_confidence=request.min_confidence)
        return result
    except Exception as e:
        logger.error(f"Error in concepts endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/process", response_model=ProcessContentResponse)
async def process_content(request: ProcessContentRequest):
    """Process content: summarize, embed, and extract concepts"""
    try:
        result = ProcessContentResponse()
        
        if request.generate_summary:
            result.summary = await summarize_content(request.content)
        
        if request.generate_embedding:
            result.embedding = await generate_embedding(request.content)
        
        if request.extract_concepts:
            result.concepts = await extract_concepts(request.content)
        
        return result
    except Exception as e:
        logger.error(f"Error in process endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/health")
async def health():
    """Health check endpoint"""
    return {"status": "healthy"}