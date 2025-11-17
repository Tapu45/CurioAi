from fastapi import APIRouter, HTTPException
from typing import List
from fastapi.responses import StreamingResponse
import json

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

from src.services.model_manager import get_model_manager
from pydantic import BaseModel
from typing import Optional

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

@router.post("/chat")
async def chat(request: dict):
    """RAG-based chat endpoint"""
    try:
        from src.services.ollama_client import ollama_client
        
        query = request.get("query", "")
        context = request.get("context", [])
        
        if not query:
            raise HTTPException(status_code=400, detail="Query is required")
        
        # Build context text
        context_text = ""
        if context:
            context_text = "\n\n".join([
                f"[Source {i+1}: {item.get('title', 'Untitled')}]\n{item.get('content', '')}"
                for i, item in enumerate(context)
            ])
        
        # Build RAG prompt
        if context_text:
            prompt = f"""You are CurioAI, a personal knowledge assistant. Answer the user's question based ONLY on the following context from their learning history. If the context doesn't contain enough information, say so.

Context:
{context_text}

User Question: {query}

Provide a helpful, concise answer based on the context above. If relevant, mention which sources you used. Keep your answer clear and focused."""
        else:
            prompt = f"""You are CurioAI, a personal knowledge assistant. The user asked: {query}

Since I don't have relevant context from your learning history, I'll provide a general answer. However, for better answers, try asking about topics you've learned about recently."""
        
        # Generate answer using Ollama
        answer = await ollama_client.generate(prompt)
        
        return {
            "answer": answer,
            "sources_used": len(context) if context else 0
        }
    except Exception as e:
        logger.error(f"Error in chat endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/rag/query")
async def rag_query(request: dict):
    """RAG query endpoint with streaming support"""
    try:
        query = request.get("query")
        context = request.get("context", [])
        stream = request.get("stream", False)
        
        if not query:
            raise HTTPException(status_code=400, detail="Query is required")
        
        # Build prompt with context
        context_text = "\n\n".join([
            f"[Source {i+1}: {item.get('title', 'Untitled')}]\n{item.get('content', '')}"
            for i, item in enumerate(context)
        ])
        
        prompt = f"Based on the following context, answer this question: {query}\n\nContext:\n{context_text}"
        
        if stream:
            # Streaming response
            async def generate_stream():
                # This would integrate with your LLM streaming
                # For now, return a simple stream
                yield f"data: {json.dumps({'type': 'start'})}\n\n"
                
                # Call LLM with streaming (implement based on your LLM)
                # For example with Ollama:
                # async for chunk in llm.stream(prompt):
                #     yield f"data: {json.dumps({'type': 'token', 'content': chunk})}\n\n"
                
                yield f"data: {json.dumps({'type': 'end'})}\n\n"
            
            return StreamingResponse(generate_stream(), media_type="text/event-stream")
        else:
            # Non-streaming response
            result = await summarize_content(prompt, max_length=500)
            return {
                "answer": result.get("summary", ""),
                "sources_used": len(context),
            }
    except Exception as e:
        logger.error(f"Error in RAG query endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class ModelUpdateRequest(BaseModel):
    llm_model: Optional[str] = None
    embedding_model: Optional[str] = None
    nlp_model: Optional[str] = None

# Add these endpoints
@router.post("/models/update")
async def update_models(request: ModelUpdateRequest):
    """Update AI service models"""
    try:
        model_manager = get_model_manager()
        result = model_manager.update_models(
            llm_model=request.llm_model,
            embedding_model=request.embedding_model,
            nlp_model=request.nlp_model,
        )
        return result
    except Exception as e:
        logger.error(f"Error updating models: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/models/current")
async def get_current_models():
    """Get current model configuration"""
    try:
        model_manager = get_model_manager()
        return model_manager.get_current_models()
    except Exception as e:
        logger.error(f"Error getting current models: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/models/resources")
async def get_resources():
    """Get system resource usage"""
    try:
        model_manager = get_model_manager()
        return model_manager.get_resource_usage()
    except Exception as e:
        logger.error(f"Error getting resources: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/models/check")
async def check_model(model: str):
    """Check if a model is available (for Ollama)"""
    try:
        # This would check Ollama for model availability
        # For now, return True (assume available)
        return {"available": True, "model": model}
    except Exception as e:
        logger.error(f"Error checking model: {e}")
        return {"available": False, "error": str(e)}