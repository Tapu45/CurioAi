from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

class SummarizeRequest(BaseModel):
    content: str = Field(..., description="Content to summarize")
    max_length: Optional[int] = Field(200, description="Maximum summary length")
    include_key_points: Optional[bool] = Field(True, description="Include key points")

class SummarizeResponse(BaseModel):
    summary: str
    key_points: List[str]
    complexity: str  # beginner, intermediate, advanced
    sentiment: float  # -1 to 1
    word_count: int

class EmbeddingRequest(BaseModel):
    text: str = Field(..., description="Text to generate embedding for")
    model: Optional[str] = Field(None, description="Embedding model to use")

class EmbeddingResponse(BaseModel):
    embedding: List[float]
    model: str
    dimension: int

class ExtractConceptsRequest(BaseModel):
    text: str = Field(..., description="Text to extract concepts from")
    min_confidence: Optional[float] = Field(0.5, description="Minimum confidence threshold")

class Concept(BaseModel):
    text: str
    label: str  # PERSON, ORG, TECH, etc.
    confidence: float
    start: int
    end: int

class ExtractConceptsResponse(BaseModel):
    concepts: List[Concept]
    keywords: List[str]
    topics: List[str]

class ProcessContentRequest(BaseModel):
    content: str = Field(..., description="Content to process")
    title: Optional[str] = Field(None, description="Content title")
    generate_summary: Optional[bool] = Field(True, description="Generate summary")
    generate_embedding: Optional[bool] = Field(True, description="Generate embedding")
    extract_concepts: Optional[bool] = Field(True, description="Extract concepts")

class ProcessContentResponse(BaseModel):
    summary: Optional[SummarizeResponse] = None
    embedding: Optional[EmbeddingResponse] = None
    concepts: Optional[ExtractConceptsResponse] = None

# Add these to schemas.py

class ClassifyActivityRequest(BaseModel):
    app_name: str = Field(..., description="Application name")
    window_title: str = Field(..., description="Window title")
    url: Optional[str] = Field(None, description="URL (if browser activity)")
    content_snippet: Optional[str] = Field(None, description="Content snippet")

class ClassifyActivityResponse(BaseModel):
    activity_type: str  # 'coding', 'reading', 'watching', etc.
    confidence: float  # 0.0 to 1.0
    metadata: Dict[str, Any] = {}
    reason: str

class BatchClassifyRequest(BaseModel):
    activities: List[ClassifyActivityRequest]

class BatchClassifyResponse(BaseModel):
    results: List[ClassifyActivityResponse]