from typing import List, Dict, Any, Optional
from llama_index.core import Document, VectorStoreIndex, Settings
from llama_index.core.node_parser import SimpleNodeParser
from llama_index.core.query_engine import RetrieverQueryEngine
from llama_index.core.retrievers import VectorIndexRetriever
from llama_index.core.response_synthesizers import ResponseMode
from llama_index.llms.ollama import Ollama
from llama_index.embeddings.huggingface import HuggingFaceEmbedding
from llama_index.readers.file import FlatReader
from llama_index.readers.pdf import PDFReader
from src.config import settings
from src.utils.logger import setup_logger
import os

logger = setup_logger()

# Global instances
_vector_store_index = None
_llm = None
_embed_model = None

def get_llm():
    """Get or initialize Ollama LLM"""
    global _llm
    if _llm is None:
        _llm = Ollama(
            model=settings.OLLAMA_MODEL,
            base_url=settings.OLLAMA_BASE_URL,
            request_timeout=60.0
        )
        Settings.llm = _llm
    return _llm

def get_embed_model():
    """Get or initialize embedding model"""
    global _embed_model
    if _embed_model is None:
        _embed_model = HuggingFaceEmbedding(
            model_name=settings.EMBEDDING_MODEL
        )
        Settings.embed_model = _embed_model
    return _embed_model

def load_documents_from_files(file_paths: List[str], chunk_size: int = 1000, chunk_overlap: int = 200) -> List[Document]:
    """
    Load documents from file paths using LlamaIndex loaders
    
    Args:
        file_paths: List of file paths
        chunk_size: Chunk size for text splitting
        chunk_overlap: Overlap between chunks
    
    Returns:
        List of LlamaIndex Document objects
    """
    try:
        documents = []
        
        # Initialize node parser
        node_parser = SimpleNodeParser.from_defaults(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap
        )
        
        for file_path in file_paths:
            try:
                if not os.path.exists(file_path):
                    logger.warn(f"File not found: {file_path}")
                    continue
                
                file_ext = os.path.splitext(file_path)[1].lower()
                
                # Use appropriate loader
                if file_ext == '.pdf':
                    reader = PDFReader()
                    docs = reader.load_data(file_path)
                elif file_ext in ['.txt', '.md']:
                    reader = FlatReader()
                    docs = reader.load_data(file_path)
                else:
                    # Try flat reader for other text files
                    reader = FlatReader()
                    docs = reader.load_data(file_path)
                
                # Add file path to metadata
                for doc in docs:
                    doc.metadata['file_path'] = file_path
                    doc.metadata['file_name'] = os.path.basename(file_path)
                
                documents.extend(docs)
                logger.info(f"Loaded {len(docs)} documents from {file_path}")
            except Exception as e:
                logger.error(f"Error loading file {file_path}: {e}")
                continue
        
        return documents
    except Exception as e:
        logger.error(f"Error loading documents: {e}")
        raise

def create_vector_store_index(documents: List[Document], persist_dir: Optional[str] = None) -> VectorStoreIndex:
    """
    Create vector store index from documents
    
    Args:
        documents: List of documents
        persist_dir: Optional directory to persist index
    
    Returns:
        VectorStoreIndex instance
    """
    try:
        # Initialize LLM and embedding model
        get_llm()
        get_embed_model()
        
        # Create index
        if persist_dir and os.path.exists(persist_dir):
            # Load existing index
            index = VectorStoreIndex.load_from_disk(persist_dir)
            logger.info(f"Loaded vector store index from {persist_dir}")
        else:
            # Create new index
            index = VectorStoreIndex.from_documents(
                documents,
                show_progress=True
            )
            
            if persist_dir:
                index.storage_context.persist(persist_dir=persist_dir)
                logger.info(f"Persisted vector store index to {persist_dir}")
        
        return index
    except Exception as e:
        logger.error(f"Error creating vector store index: {e}")
        raise

def create_query_engine(index: VectorStoreIndex, k: int = 5, response_mode: str = "compact") -> RetrieverQueryEngine:
    """
    Create query engine from vector store index
    
    Args:
        index: VectorStoreIndex instance
        k: Number of documents to retrieve
        response_mode: Response synthesis mode
    
    Returns:
        RetrieverQueryEngine instance
    """
    try:
        # Create retriever
        retriever = VectorIndexRetriever(
            index=index,
            similarity_top_k=k
        )
        
        # Create query engine
        query_engine = RetrieverQueryEngine.from_args(
            retriever=retriever,
            response_mode=response_mode
        )
        
        return query_engine
    except Exception as e:
        logger.error(f"Error creating query engine: {e}")
        raise

async def query_index(query: str, index: VectorStoreIndex, k: int = 5) -> Dict[str, Any]:
    """
    Query vector store index
    
    Args:
        query: Query text
        index: VectorStoreIndex instance
        k: Number of results
    
    Returns:
        Dictionary with answer and sources
    """
    try:
        query_engine = create_query_engine(index, k)
        
        # Query
        response = query_engine.query(query)
        
        # Extract sources
        sources = []
        if hasattr(response, 'source_nodes'):
            for node in response.source_nodes:
                sources.append({
                    'text': node.text,
                    'score': node.score if hasattr(node, 'score') else 0.0,
                    'metadata': node.metadata if hasattr(node, 'metadata') else {},
                })
        
        return {
            'answer': str(response),
            'sources': sources,
            'metadata': {
                'query': query,
                'num_sources': len(sources),
            }
        }
    except Exception as e:
        logger.error(f"Error querying index: {e}")
        raise

def load_documents_from_directory(directory_path: str, recursive: bool = True, patterns: List[str] = None) -> List[Document]:
    """
    Load documents from directory
    
    Args:
        directory_path: Directory path
        recursive: Include subdirectories
        patterns: File patterns to match
    
    Returns:
        List of documents
    """
    try:
        if patterns is None:
            patterns = ['**/*.pdf', '**/*.txt', '**/*.md', '**/*.docx']
        
        documents = []
        file_paths = []
        
        # Collect file paths
        if recursive:
            import glob
            for pattern in patterns:
                full_pattern = os.path.join(directory_path, pattern)
                file_paths.extend(glob.glob(full_pattern, recursive=True))
        else:
            import glob
            for pattern in patterns:
                full_pattern = os.path.join(directory_path, pattern)
                file_paths.extend(glob.glob(full_pattern))
        
        # Remove duplicates
        file_paths = list(set(file_paths))
        
        # Load documents
        documents = load_documents_from_files(file_paths)
        
        logger.info(f"Loaded {len(documents)} documents from {directory_path}")
        return documents
    except Exception as e:
        logger.error(f"Error loading documents from directory: {e}")
        raise

# Global index cache
_index_cache = {}
_index_persist_dir = None

def set_index_persist_dir(persist_dir: str):
    """Set directory for persisting indices"""
    global _index_persist_dir
    _index_persist_dir = persist_dir
    os.makedirs(persist_dir, exist_ok=True)

def get_vector_store_index(index_id: str = "default", force_reload: bool = False) -> Optional[VectorStoreIndex]:
    """
    Get or create vector store index (cached)
    
    Args:
        index_id: Index identifier
        force_reload: Force reload from disk
    
    Returns:
        VectorStoreIndex instance or None
    """
    global _index_cache, _index_persist_dir
    
    # Check cache
    if not force_reload and index_id in _index_cache:
        return _index_cache[index_id]
    
    # Try to load from disk
    if _index_persist_dir:
        persist_path = os.path.join(_index_persist_dir, index_id)
        if os.path.exists(persist_path) and not force_reload:
            try:
                index = VectorStoreIndex.load_from_disk(persist_path)
                _index_cache[index_id] = index
                logger.info(f"Loaded index {index_id} from disk")
                return index
            except Exception as e:
                logger.warn(f"Failed to load index from disk: {e}")
    
    return None

def update_vector_store_index(documents: List[Document], index_id: str = "default") -> VectorStoreIndex:
    """
    Update or create vector store index with new documents
    
    Args:
        documents: List of documents to add
        index_id: Index identifier
    
    Returns:
        VectorStoreIndex instance
    """
    global _index_cache, _index_persist_dir
    
    # Get existing index or create new
    index = get_vector_store_index(index_id)
    
    if index is None:
        # Create new index
        index = create_vector_store_index(documents, None)
    else:
        # Update existing index
        # Note: LlamaIndex doesn't support direct updates, so we rebuild
        # In production, use incremental indexing
        existing_docs = []  # Would load existing documents
        all_docs = existing_docs + documents
        index = create_vector_store_index(all_docs, None)
    
    # Cache and persist
    _index_cache[index_id] = index
    
    if _index_persist_dir:
        persist_path = os.path.join(_index_persist_dir, index_id)
        index.storage_context.persist(persist_dir=persist_path)
        logger.info(f"Persisted index {index_id} to {persist_path}")
    
    return index