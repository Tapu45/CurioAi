from typing import Dict, Any, List, Optional
import pdfplumber
import json
from src.services.ollama_client import ollama_client
from src.utils.logger import setup_logger

logger = setup_logger()

async def extract_structured_data(file_path: str, file_type: str) -> Dict[str, Any]:
    """
    Extract structured data from documents (forms, key-value pairs, percentages)
    
    Args:
        file_path: Path to document file
        file_type: MIME type or file extension
    
    Returns:
        Dictionary with extracted structured data
    """
    try:
        results = {
            'data': [],
            'confidence': 0.0,
            'method': 'llm-extraction'
        }
        
        # Extract text content first
        text_content = await extract_text_content(file_path, file_type)
        
        if not text_content:
            return results
        
        # Use LLM to extract structured data with JSON schema
        structured_data = await extract_with_llm(text_content)
        
        results['data'] = structured_data
        results['confidence'] = 0.85  # LLM extraction confidence
        
        return results
    except Exception as e:
        logger.error(f"Error extracting structured data from {file_path}: {e}")
        raise

async def extract_text_content(file_path: str, file_type: str) -> str:
    """Extract text content from document"""
    try:
        if file_type.endswith('.pdf') or 'pdf' in file_type.lower():
            return await extract_pdf_text(file_path)
        elif file_type.endswith('.docx') or 'word' in file_type.lower():
            # Use existing docx extractor or pdfplumber alternative
            return await extract_docx_text(file_path)
        else:
            # Try reading as text
            with open(file_path, 'r', encoding='utf-8') as f:
                return f.read()
    except Exception as e:
        logger.error(f"Error extracting text content: {e}")
        return ""

async def extract_pdf_text(file_path: str) -> str:
    """Extract text from PDF"""
    try:
        text_parts = []
        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages:
                text = page.extract_text()
                if text:
                    text_parts.append(text)
        return '\n\n'.join(text_parts)
    except Exception as e:
        logger.error(f"Error extracting PDF text: {e}")
        return ""

async def extract_docx_text(file_path: str) -> str:
    """Extract text from DOCX (placeholder - implement with python-docx or mammoth)"""
    # For now, return empty - can be enhanced later
    return ""

async def extract_with_llm(text_content: str) -> List[Dict[str, Any]]:
    """
    Use LLM to extract structured data with JSON schema
    
    Returns:
        List of extracted data items
    """
    try:
        prompt = f"""Extract structured data from the following text. Look for:
- Percentages (e.g., "85%", "Grade: A")
- Key-value pairs (e.g., "Name: John", "Date: 2024-01-01")
- Lists (numbered or bulleted)
- Form fields

Return the results as a JSON array with this structure:
[
    {{
        "type": "percentage" | "key_value" | "list" | "form",
        "key": "field name or label",
        "value": "extracted value",
        "confidence": 0.0-1.0
    }}
]

Text to analyze:
{text_content[:4000]}  # Limit to avoid token limits

Return only valid JSON, no additional text."""

        response = await ollama_client.generate(prompt)
        
        # Parse JSON response
        try:
            # Try to extract JSON from response
            json_start = response.find('[')
            json_end = response.rfind(']') + 1
            if json_start >= 0 and json_end > json_start:
                json_str = response[json_start:json_end]
                structured_data = json.loads(json_str)
                return structured_data
            else:
                # Fallback: try parsing entire response
                structured_data = json.loads(response)
                return structured_data
        except json.JSONDecodeError:
            logger.warn("Failed to parse LLM response as JSON")
            return []
    except Exception as e:
        logger.error(f"Error in LLM extraction: {e}")
        return []