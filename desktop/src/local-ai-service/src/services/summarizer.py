from typing import List, Optional
from src.services.ollama_client import ollama_client
from src.api.schemas import SummarizeResponse
from src.prompts.summarization import get_summarization_prompt
from src.utils.logger import setup_logger
import re

logger = setup_logger()

async def summarize_content(
    content: str,
    max_length: int = 200,
    include_key_points: bool = True
) -> SummarizeResponse:
    """Summarize content using local LLM"""
    try:
        # Truncate content if too long (to avoid token limits)
        max_content_length = 4000
        if len(content) > max_content_length:
            content = content[:max_content_length] + "..."
        
        # Get summarization prompt
        prompt = get_summarization_prompt(content, max_length, include_key_points)
        
        # Generate summary
        response = await ollama_client.generate(prompt)
        
        # Parse response
        summary, key_points, complexity, sentiment = parse_summary_response(
            response,
            include_key_points
        )
        
        return SummarizeResponse(
            summary=summary,
            key_points=key_points,
            complexity=complexity,
            sentiment=sentiment,
            word_count=len(summary.split())
        )
    except Exception as e:
        logger.error(f"Error summarizing content: {e}")
        # Return fallback summary
        return SummarizeResponse(
            summary=content[:max_length] + "..." if len(content) > max_length else content,
            key_points=[],
            complexity="intermediate",
            sentiment=0.0,
            word_count=len(content.split())
        )

def parse_summary_response(response: str, include_key_points: bool) -> tuple:
    """Parse LLM response into structured format"""
    summary = ""
    key_points = []
    complexity = "intermediate"
    sentiment = 0.0
    
    # Extract summary
    summary_match = re.search(r'Summary[:\s]*(.+?)(?:\n\n|Key Points|$)', response, re.DOTALL)
    if summary_match:
        summary = summary_match.group(1).strip()
    else:
        # Fallback: use first paragraph
        summary = response.split('\n\n')[0].strip()
    
    # Extract key points
    if include_key_points:
        points_match = re.search(r'Key Points?[:\s]*(.+?)(?:\n\n|Complexity|$)', response, re.DOTALL)
        if points_match:
            points_text = points_match.group(1)
            key_points = [
                point.strip().lstrip('-•* ')
                for point in points_text.split('\n')
                if point.strip()
            ]
    
    # Extract complexity
    complexity_match = re.search(r'Complexity[:\s]*(beginner|intermediate|advanced)', response, re.IGNORECASE)
    if complexity_match:
        complexity = complexity_match.group(1).lower()
    
    # Extract sentiment (simple heuristic)
    positive_words = ['good', 'great', 'excellent', 'positive', 'beneficial', 'helpful']
    negative_words = ['bad', 'poor', 'negative', 'problem', 'issue', 'difficult']
    
    text_lower = response.lower()
    positive_count = sum(1 for word in positive_words if word in text_lower)
    negative_count = sum(1 for word in negative_words if word in text_lower)
    
    if positive_count > negative_count:
        sentiment = min(0.5, positive_count * 0.1)
    elif negative_count > positive_count:
        sentiment = max(-0.5, -negative_count * 0.1)
    
    return summary, key_points, complexity, sentiment