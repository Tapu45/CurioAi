"""
Activity Insights Service using LlamaIndex and LangChain
Generates AI-powered insights from user activities
"""
from typing import Dict, List, Optional, Any
from llama_index.core import Document
from llama_index.core.query_engine import RetrieverQueryEngine
from llama_index.core.retrievers import VectorIndexRetriever
from llama_index.core.response_synthesizers import ResponseMode
from llama_index.llms.ollama import Ollama
from langchain.output_parsers import PydanticOutputParser
from langchain.prompts import PromptTemplate
from langchain_core.pydantic_v1 import BaseModel, Field
from src.config import settings
from src.services.ollama_client import ollama_client
from src.services.llamaindex_service import get_vector_store_index, create_query_engine
from src.utils.logger import setup_logger
from datetime import datetime, timedelta
import json

logger = setup_logger()

# Pydantic models for structured output
class DailySummary(BaseModel):
    summary: str = Field(description="Brief summary of the day's activities")
    activities: List[str] = Field(description="List of main activities")
    time_spent: Dict[str, int] = Field(description="Time spent per activity type in minutes")
    concepts_learned: List[str] = Field(description="Key concepts learned")
    insights: List[str] = Field(description="Key insights about the day")

class WeeklyInsights(BaseModel):
    summary: str = Field(description="Weekly summary")
    patterns: List[str] = Field(description="Learning patterns identified")
    recommendations: List[str] = Field(description="Recommendations for improvement")
    knowledge_grains: List[str] = Field(description="Knowledge grains learned this week")
    time_distribution: Dict[str, int] = Field(description="Time distribution across activity types")

class LearningGap(BaseModel):
    concept: str = Field(description="Concept that was watched but not applied")
    watched_date: str = Field(description="Date when concept was watched")
    days_since: int = Field(description="Days since watching")
    recommendation: str = Field(description="Recommendation to apply the concept")

class FocusArea(BaseModel):
    area: str = Field(description="Area to focus on")
    reason: str = Field(description="Why this area needs focus")
    priority: str = Field(description="Priority level: high, medium, low")
    action_items: List[str] = Field(description="Action items to improve")

async def generate_daily_summary_ai(activities_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Generate AI-powered daily summary using LlamaIndex RAG
    
    Args:
        activities_data: Dictionary with activities, sessions, concepts, etc.
    
    Returns:
        Dictionary with AI-generated summary
    """
    try:
        # Prepare context from activities
        context_text = build_activities_context(activities_data)
        
        # Create document from context
        doc = Document(
            text=context_text,
            metadata={
                "date": activities_data.get("date", ""),
                "type": "daily_summary",
            }
        )
        
        # Get or create index
        index = get_vector_store_index("activities")
        if index is None:
            # Create index with this document
            from src.services.llamaindex_service import create_vector_store_index
            index = create_vector_store_index([doc], None)
        
        # Create query engine
        query_engine = create_query_engine(index, k=5)
        
        # Query for summary
        query = f"""Based on the following activities from {activities_data.get('date', 'today')}, 
        generate a comprehensive daily summary. Include:
        1. What the user did (activities, sessions)
        2. What they learned (concepts, topics)
        3. Time spent on different activities
        4. Key insights and patterns
        
        Activities data:
        {context_text}
        
        Provide a natural, conversational summary as if you're a mentor reviewing their day."""
        
        response = query_engine.query(query)
        
        # Parse structured output using LangChain
        parser = PydanticOutputParser(pydantic_object=DailySummary)
        
        # Use LangChain to parse with Ollama
        prompt = PromptTemplate(
            template="""You are a learning mentor. Generate a structured daily summary from this text:
            
            {summary_text}
            
            {format_instructions}
            
            Output only valid JSON matching the schema.""",
            input_variables=["summary_text"],
            partial_variables={"format_instructions": parser.get_format_instructions()}
        )
        
        # Get LLM response
        llm_response = await ollama_client.generate(
            prompt.format(summary_text=str(response))
        )
        
        # Parse JSON response
        try:
            # Extract JSON from response
            json_match = llm_response.find('{')
            if json_match != -1:
                json_text = llm_response[json_match:]
                json_end = json_text.rfind('}')
                if json_end != -1:
                    json_text = json_text[:json_end + 1]
                    parsed = json.loads(json_text)
                    return DailySummary(**parsed).dict()
        except Exception as e:
            logger.warn(f"Failed to parse structured output: {e}, using raw response")
        
        # Fallback to simple summary
        return {
            "summary": str(response),
            "activities": activities_data.get("activities", []),
            "time_spent": activities_data.get("time_spent", {}),
            "concepts_learned": activities_data.get("concepts", []),
            "insights": [str(response)],
        }
    except Exception as e:
        logger.error(f"Error generating daily summary: {e}")
        return {
            "summary": "Unable to generate AI summary",
            "activities": [],
            "time_spent": {},
            "concepts_learned": [],
            "insights": [],
        }

async def generate_weekly_insights_ai(weekly_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Generate AI-powered weekly insights using RAG
    """
    try:
        context_text = build_weekly_context(weekly_data)
        
        # Create document
        doc = Document(
            text=context_text,
            metadata={
                "week": weekly_data.get("week_start", ""),
                "type": "weekly_insights",
            }
        )
        
        # Get or create index
        index = get_vector_store_index("activities")
        if index is None:
            from src.services.llamaindex_service import create_vector_store_index
            index = create_vector_store_index([doc], None)
        
        query_engine = create_query_engine(index, k=10)
        
        query = f"""Analyze this week's learning activities and provide insights:
        
        {context_text}
        
        Generate insights about:
        1. Learning patterns (watching vs coding ratio, consistency)
        2. Knowledge progression (what concepts were learned and applied)
        3. Recommendations for improvement
        4. Key knowledge grains acquired
        
        Be specific and actionable."""
        
        response = query_engine.query(query)
        
        # Parse with LangChain
        parser = PydanticOutputParser(pydantic_object=WeeklyInsights)
        prompt = PromptTemplate(
            template="""Generate structured weekly insights:
            
            {insights_text}
            
            {format_instructions}
            
            Output only valid JSON.""",
            input_variables=["insights_text"],
            partial_variables={"format_instructions": parser.get_format_instructions()}
        )
        
        llm_response = await ollama_client.generate(
            prompt.format(insights_text=str(response))
        )
        
        try:
            json_match = llm_response.find('{')
            if json_match != -1:
                json_text = llm_response[json_match:]
                json_end = json_text.rfind('}')
                if json_end != -1:
                    json_text = json_text[:json_end + 1]
                    parsed = json.loads(json_text)
                    return WeeklyInsights(**parsed).dict()
        except Exception as e:
            logger.warn(f"Failed to parse structured output: {e}")
        
        return {
            "summary": str(response),
            "patterns": [],
            "recommendations": [],
            "knowledge_grains": [],
            "time_distribution": weekly_data.get("time_distribution", {}),
        }
    except Exception as e:
        logger.error(f"Error generating weekly insights: {e}")
        return {
            "summary": "Unable to generate insights",
            "patterns": [],
            "recommendations": [],
            "knowledge_grains": [],
            "time_distribution": {},
        }

async def identify_learning_gaps_ai(gaps_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Use AI to analyze learning gaps and provide recommendations
    """
    try:
        if not gaps_data:
            return []
        
        context = "\n".join([
            f"- {gap.get('concept', 'Unknown')}: Watched {gap.get('days_since', 0)} days ago in '{gap.get('watched_in', 'Unknown')}'"
            for gap in gaps_data
        ])
        
        query = f"""Analyze these learning gaps where concepts were watched but not applied:
        
        {context}
        
        For each gap, provide:
        1. Why it might not have been applied
        2. Specific recommendation to apply it
        3. Suggested project or exercise
        
        Be encouraging and actionable."""
        
        response = await ollama_client.generate(query)
        
        # Parse gaps with recommendations
        parser = PydanticOutputParser(pydantic_object=List[LearningGap])
        prompt = PromptTemplate(
            template="""Extract learning gaps from this analysis:
            
            {analysis_text}
            
            {format_instructions}
            
            Output only valid JSON array.""",
            input_variables=["analysis_text"],
            partial_variables={"format_instructions": parser.get_format_instructions()}
        )
        
        llm_response = await ollama_client.generate(
            prompt.format(analysis_text=response)
        )
        
        try:
            json_match = llm_response.find('[')
            if json_match != -1:
                json_text = llm_response[json_match:]
                json_end = json_text.rfind(']')
                if json_end != -1:
                    json_text = json_text[:json_end + 1]
                    parsed = json.loads(json_text)
                    return [LearningGap(**gap).dict() for gap in parsed]
        except Exception as e:
            logger.warn(f"Failed to parse learning gaps: {e}")
        
        # Fallback: add recommendations to existing gaps
        return [
            {
                **gap,
                "recommendation": "Consider applying this concept in a coding project to reinforce learning."
            }
            for gap in gaps_data
        ]
    except Exception as e:
        logger.error(f"Error identifying learning gaps: {e}")
        return gaps_data

async def suggest_focus_areas_ai(activity_data: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Use AI to suggest focus areas based on activity patterns
    """
    try:
        context = build_focus_areas_context(activity_data)
        
        query = f"""Based on this activity data, suggest focus areas:
        
        {context}
        
        Provide:
        1. Areas that need more attention
        2. Why each area is important
        3. Priority level (high, medium, low)
        4. Specific action items
        
        Be specific and actionable."""
        
        response = await ollama_client.generate(query)
        
        parser = PydanticOutputParser(pydantic_object=List[FocusArea])
        prompt = PromptTemplate(
            template="""Extract focus areas from this analysis:
            
            {analysis_text}
            
            {format_instructions}
            
            Output only valid JSON array.""",
            input_variables=["analysis_text"],
            partial_variables={"format_instructions": parser.get_format_instructions()}
        )
        
        llm_response = await ollama_client.generate(
            prompt.format(analysis_text=response)
        )
        
        try:
            json_match = llm_response.find('[')
            if json_match != -1:
                json_text = llm_response[json_match:]
                json_end = json_text.rfind(']')
                if json_end != -1:
                    json_text = json_text[:json_end + 1]
                    parsed = json.loads(json_text)
                    return [FocusArea(**area).dict() for area in parsed]
        except Exception as e:
            logger.warn(f"Failed to parse focus areas: {e}")
        
        return []
    except Exception as e:
        logger.error(f"Error suggesting focus areas: {e}")
        return []

def build_activities_context(activities_data: Dict[str, Any]) -> str:
    """Build context text from activities data"""
    parts = []
    
    if activities_data.get("date"):
        parts.append(f"Date: {activities_data['date']}")
    
    if activities_data.get("activities"):
        parts.append("\nActivities:")
        for activity in activities_data["activities"]:
            parts.append(f"- {activity.get('type', 'unknown')}: {activity.get('title', 'Unknown')}")
    
    if activities_data.get("sessions"):
        parts.append("\nSessions:")
        for session in activities_data["sessions"]:
            parts.append(f"- {session.get('type', 'unknown')}: {session.get('summary', 'No summary')} ({session.get('duration', 0)}s)")
    
    if activities_data.get("concepts"):
        parts.append(f"\nConcepts learned: {', '.join(activities_data['concepts'])}")
    
    if activities_data.get("time_spent"):
        parts.append("\nTime spent:")
        for activity_type, minutes in activities_data["time_spent"].items():
            parts.append(f"- {activity_type}: {minutes} minutes")
    
    return "\n".join(parts)

def build_weekly_context(weekly_data: Dict[str, Any]) -> str:
    """Build context text for weekly insights"""
    parts = []
    
    parts.append(f"Week: {weekly_data.get('week_start', 'Unknown')} to {weekly_data.get('week_end', 'Unknown')}")
    parts.append(f"Total activities: {weekly_data.get('total_activities', 0)}")
    
    if weekly_data.get("daily_stats"):
        parts.append("\nDaily breakdown:")
        for day, stats in weekly_data["daily_stats"].items():
            parts.append(f"- {day}: {stats.get('count', 0)} activities")
    
    if weekly_data.get("type_stats"):
        parts.append("\nActivity types:")
        for activity_type, count in weekly_data["type_stats"].items():
            parts.append(f"- {activity_type}: {count}")
    
    if weekly_data.get("concepts"):
        parts.append(f"\nConcepts: {', '.join(weekly_data['concepts'])}")
    
    return "\n".join(parts)

def build_focus_areas_context(activity_data: Dict[str, Any]) -> str:
    """Build context for focus areas analysis"""
    parts = []
    
    if activity_data.get("type_distribution"):
        parts.append("Activity distribution:")
        for activity_type, count in activity_data["type_distribution"].items():
            parts.append(f"- {activity_type}: {count}")
    
    if activity_data.get("time_by_type"):
        parts.append("\nTime spent:")
        for activity_type, seconds in activity_data["time_by_type"].items():
            minutes = seconds // 60
            parts.append(f"- {activity_type}: {minutes} minutes")
    
    if activity_data.get("top_concepts"):
        parts.append(f"\nTop concepts: {', '.join(activity_data['top_concepts'])}")
    
    return "\n".join(parts)