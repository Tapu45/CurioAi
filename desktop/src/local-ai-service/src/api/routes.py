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
from src.services.entity_extractor_enhanced import extract_entities_enhanced

from src.services.vision.image_analyzer import analyze_image
from src.services.extraction.structured_extractor import extract_structured_data
from src.services.extraction.table_extractor import extract_tables
from fastapi import UploadFile, File

from src.services.model_manager import get_model_manager
from pydantic import BaseModel
from typing import Optional

from src.services.llamaindex_service import (
    load_documents_from_files,
    load_documents_from_directory,
    create_vector_store_index,
    query_index,
    create_query_engine,
)
from llama_index.core import Document
from src.api.schemas import (
    ClassifyActivityRequest,
    ClassifyActivityResponse,
    BatchClassifyRequest,
    BatchClassifyResponse,
)
from src.services.activity_classifier_ml import (
    classify_activity_ml,
    batch_classify_activities,
    should_use_ml_classifier,
)

from src.services.embedding_service_v2 import (
    generate_embedding,
    batch_generate_embeddings,
    get_embedding_model_for_tier,
    get_model_dimension,
)

from src.services.activity_insights import (
    generate_daily_summary_ai,
    generate_weekly_insights_ai,
    identify_learning_gaps_ai,
    suggest_focus_areas_ai,
)

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
    """Extract concepts and entities from text (enhanced)"""
    try:
        result = await extract_entities_enhanced(
            request.text,
            min_confidence=request.min_confidence
        )
        return result
    except Exception as e:
        logger.error(f"Error in concepts endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class ExtractEntitiesRequest(BaseModel):
    text: str
    extract_types: Optional[List[str]] = None  # ['movie', 'game', 'book', etc.]
    min_confidence: Optional[float] = 0.5

@router.post("/extract-entities", response_model=ExtractConceptsResponse)
async def extract_entities(request: ExtractEntitiesRequest):
    """Extract specialized entities (movies, games, books, etc.)"""
    try:
        result = await extract_entities_enhanced(
            request.text,
            min_confidence=request.min_confidence,
            extract_types=request.extract_types
        )
        return result
    except Exception as e:
        logger.error(f"Error in extract-entities endpoint: {e}")
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

@router.post("/analyze-image")
async def analyze_image_endpoint(request: dict):
    """Analyze image: OCR + vision model"""
    try:
        file_path = request.get("file_path")
        options = request.get("options", {})
        
        if not file_path:
            raise HTTPException(status_code=400, detail="file_path is required")
        
        result = await analyze_image(file_path, options)
        return result
    except Exception as e:
        logger.error(f"Error in analyze-image endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/extract-structured")
async def extract_structured_endpoint(request: dict):
    """Extract structured data from documents"""
    try:
        file_path = request.get("file_path")
        file_type = request.get("file_type", "")
        
        if not file_path:
            raise HTTPException(status_code=400, detail="file_path is required")
        
        result = await extract_structured_data(file_path, file_type)
        return result
    except Exception as e:
        logger.error(f"Error in extract-structured endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/extract-tables")
async def extract_tables_endpoint(request: dict):
    """Extract tables from documents"""
    try:
        file_path = request.get("file_path")
        file_type = request.get("file_type", "")
        
        if not file_path:
            raise HTTPException(status_code=400, detail="file_path is required")
        
        result = await extract_tables(file_path, file_type)
        return result
    except Exception as e:
        logger.error(f"Error in extract-tables endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/llamaindex/load-documents")
async def llamaindex_load_documents(request: dict):
    """Load documents using LlamaIndex loaders"""
    try:
        file_paths = request.get("file_paths", [])
        chunk_size = request.get("chunk_size", 1000)
        chunk_overlap = request.get("chunk_overlap", 200)
        
        if not file_paths:
            raise HTTPException(status_code=400, detail="file_paths is required")
        
        documents = load_documents_from_files(file_paths, chunk_size, chunk_overlap)
        
        # Convert to JSON-serializable format
        result = []
        for doc in documents:
            result.append({
                'id': doc.id_ if hasattr(doc, 'id_') else None,
                'text': doc.text,
                'content': doc.text,  # Alias for compatibility
                'metadata': doc.metadata,
                'file_path': doc.metadata.get('file_path', ''),
            })
        
        return {
            'documents': result,
            'count': len(result)
        }
    except Exception as e:
        logger.error(f"Error in llamaindex/load-documents: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/llamaindex/load-directory")
async def llamaindex_load_directory(request: dict):
    """Load documents from directory"""
    try:
        directory_path = request.get("directory_path")
        recursive = request.get("recursive", True)
        patterns = request.get("patterns", ['**/*'])
        
        if not directory_path:
            raise HTTPException(status_code=400, detail="directory_path is required")
        
        documents = load_documents_from_directory(directory_path, recursive, patterns)
        
        # Convert to JSON-serializable format
        result = []
        for doc in documents:
            result.append({
                'id': doc.id_ if hasattr(doc, 'id_') else None,
                'text': doc.text,
                'content': doc.text,
                'metadata': doc.metadata,
                'file_path': doc.metadata.get('file_path', ''),
            })
        
        return {
            'documents': result,
            'count': len(result)
        }
    except Exception as e:
        logger.error(f"Error in llamaindex/load-directory: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/llamaindex/query")
async def llamaindex_query(request: dict):
    """Query using LlamaIndex query engine"""
    try:
        query = request.get("query")
        k = request.get("k", 5)
        filters = request.get("filters", {})
        use_reranking = request.get("use_reranking", False)
        
        if not query:
            raise HTTPException(status_code=400, detail="query is required")
        
        # For now, use a simple approach - in production, maintain index instances
        # This is a simplified version - you may want to maintain index cache
        from src.services.llamaindex_service import get_vector_store_index
        
        # Get or create index (this should be cached in production)
        index = get_vector_store_index()
        
        if not index:
            raise HTTPException(status_code=500, detail="Vector store index not available")
        
        result = await query_index(query, index, k)
        
        return result
    except Exception as e:
        logger.error(f"Error in llamaindex/query: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/llamaindex/create-retriever-engine")
async def llamaindex_create_retriever_engine(request: dict):
    """Create retriever query engine"""
    try:
        k = request.get("k", 5)
        response_mode = request.get("response_mode", "compact")
        
        from src.services.llamaindex_service import get_vector_store_index, create_query_engine
        
        index = get_vector_store_index()
        if not index:
            raise HTTPException(status_code=500, detail="Vector store index not available")
        
        query_engine = create_query_engine(index, k, response_mode)
        
        # Store engine (in production, use proper caching)
        engine_id = f"engine_{id(query_engine)}"
        
        return {
            'engine_id': engine_id,
            'k': k,
            'response_mode': response_mode,
        }
    except Exception as e:
        logger.error(f"Error creating retriever engine: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/llamaindex/create-router-engine")
async def llamaindex_create_router_engine(request: dict):
    """Create router query engine for multi-source queries"""
    try:
        sources = request.get("sources", [])
        
        if not sources:
            raise HTTPException(status_code=400, detail="sources is required")
        
        # Router engine implementation
        # This would create multiple query engines and route queries appropriately
        # Simplified version for now
        
        return {
            'engine_id': f"router_{len(sources)}",
            'sources': sources,
        }
    except Exception as e:
        logger.error(f"Error creating router engine: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/classify-activity", response_model=ClassifyActivityResponse)
async def classify_activity(request: ClassifyActivityRequest):
    """Classify activity using ML (if tier supports) or rule-based"""
    try:
        result = await classify_activity_ml(
            app_name=request.app_name,
            window_title=request.window_title,
            url=request.url,
            content_snippet=request.content_snippet,
        )
        return result
    except Exception as e:
        logger.error(f"Error in classify-activity endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/batch-classify", response_model=BatchClassifyResponse)
async def batch_classify(request: BatchClassifyRequest):
    """Classify multiple activities in batch"""
    try:
        results = await batch_classify_activities(request.activities)
        return BatchClassifyResponse(results=results)
    except Exception as e:
        logger.error(f"Error in batch-classify endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/classifier/status")
async def get_classifier_status():
    """Get classifier status (ML available or rule-based only)"""
    try:
        use_ml = should_use_ml_classifier()
        model_manager = get_model_manager()
        tier = model_manager.get_recommended_tier() if not settings.MODEL_TIER else settings.MODEL_TIER
        
        return {
            "ml_available": use_ml,
            "tier": tier,
            "method": "ml" if use_ml else "rule-based",
        }
    except Exception as e:
        logger.error(f"Error getting classifier status: {e}")
        return {
            "ml_available": False,
            "tier": "UNKNOWN",
            "method": "rule-based",
        }

class BatchEmbeddingRequest(BaseModel):
    texts: List[str] = Field(..., description="List of texts to generate embeddings for")
    model: Optional[str] = Field(None, description="Embedding model to use")
    tier: Optional[str] = Field(None, description="System tier (LOW_END, MID_RANGE, HIGH_END, PREMIUM)")

class BatchEmbeddingResponse(BaseModel):
    embeddings: List[EmbeddingResponse]

# Update existing embedding endpoint to use v2
@router.post("/embedding", response_model=EmbeddingResponse)
async def get_embedding(request: EmbeddingRequest):
    """Generate embedding for text"""
    try:
        result = await generate_embedding(request.text, model=request.model)
        return result
    except Exception as e:
        logger.error(f"Error in embedding endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Add batch embedding endpoint
@router.post("/batch-embeddings", response_model=BatchEmbeddingResponse)
async def batch_embeddings(request: BatchEmbeddingRequest):
    """Generate embeddings for multiple texts in batch"""
    try:
        results = await batch_generate_embeddings(
            request.texts,
            model=request.model,
            tier=request.tier
        )
        return BatchEmbeddingResponse(embeddings=results)
    except Exception as e:
        logger.error(f"Error in batch-embeddings endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Add model info endpoint
@router.get("/embedding/model-info")
async def get_embedding_model_info(tier: Optional[str] = None):
    """Get current embedding model information"""
    try:
        model_manager = get_model_manager()
        if tier:
            model = get_embedding_model_for_tier(tier)
        else:
            tier = model_manager.get_recommended_tier() if not settings.MODEL_TIER else settings.MODEL_TIER
            model = get_embedding_model_for_tier(tier)
        
        dimension = get_model_dimension()
        
        return {
            "tier": tier,
            "model": model.get_sentence_embedding_dimension() if hasattr(model, 'get_sentence_embedding_dimension') else "unknown",
            "dimension": dimension,
        }
    except Exception as e:
        logger.error(f"Error getting embedding model info: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class GenerateInsightsRequest(BaseModel):
    activities_data: Dict[str, Any] = Field(..., description="Activities data for insights")
    insight_type: str = Field(..., description="Type: 'daily', 'weekly', 'gaps', 'focus'")

class GenerateInsightsResponse(BaseModel):
    insights: Dict[str, Any]
    generated_at: str

# Add endpoints
@router.post("/generate-insights", response_model=GenerateInsightsResponse)
async def generate_insights(request: GenerateInsightsRequest):
    """Generate AI-powered insights from activities"""
    try:
        insight_type = request.insight_type
        
        if insight_type == 'daily':
            insights = await generate_daily_summary_ai(request.activities_data)
        elif insight_type == 'weekly':
            insights = await generate_weekly_insights_ai(request.activities_data)
        elif insight_type == 'gaps':
            gaps_data = request.activities_data.get('gaps', [])
            insights = await identify_learning_gaps_ai(gaps_data)
        elif insight_type == 'focus':
            insights = await suggest_focus_areas_ai(request.activities_data)
        else:
            raise HTTPException(status_code=400, detail=f"Unknown insight type: {insight_type}")
        
        return GenerateInsightsResponse(
            insights=insights,
            generated_at=datetime.now().isoformat()
        )
    except Exception as e:
        logger.error(f"Error generating insights: {e}")
        raise HTTPException(status_code=500, detail=str(e))