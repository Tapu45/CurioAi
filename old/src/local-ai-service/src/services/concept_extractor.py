import spacy
from typing import List
from src.api.schemas import ExtractConceptsResponse, Concept
from src.config import settings
from src.utils.logger import setup_logger
import re

logger = setup_logger()

# Global spaCy model instance
_nlp_model = None

def get_nlp_model():
    """Get or load spaCy model"""
    global _nlp_model
    if _nlp_model is None:
        try:
            logger.info(f"Loading spaCy model: {settings.SPACY_MODEL}")
            _nlp_model = spacy.load(settings.SPACY_MODEL)
            logger.info(f"spaCy model loaded: {settings.SPACY_MODEL}")
        except OSError:
            logger.error(f"spaCy model {settings.SPACY_MODEL} not found. Please install it with: python -m spacy download {settings.SPACY_MODEL}")
            raise
    
    return _nlp_model

async def extract_concepts(text: str, min_confidence: float = 0.5) -> ExtractConceptsResponse:
    """Extract concepts and entities from text"""
    try:
        nlp = get_nlp_model()
        doc = nlp(text)
        
        # Extract named entities
        concepts = []
        for ent in doc.ents:
            # Map spaCy labels to our labels
            label_map = {
                'PERSON': 'PERSON',
                'ORG': 'ORGANIZATION',
                'GPE': 'LOCATION',
                'PRODUCT': 'TECH',
                'TECHNOLOGY': 'TECH',
                'MONEY': 'OTHER',
                'DATE': 'OTHER',
            }
            
            label = label_map.get(ent.label_, 'OTHER')
            
            concepts.append(Concept(
                text=ent.text,
                label=label,
                confidence=0.8,  # spaCy doesn't provide confidence, use default
                start=ent.start_char,
                end=ent.end_char
            ))
        
        # Extract keywords (noun phrases and important terms)
        keywords = extract_keywords(doc)
        
        # Extract topics (main subjects)
        topics = extract_topics(doc, concepts)
        
        return ExtractConceptsResponse(
            concepts=concepts,
            keywords=keywords,
            topics=topics
        )
    except Exception as e:
        logger.error(f"Error extracting concepts: {e}")
        # Return empty response on error
        return ExtractConceptsResponse(
            concepts=[],
            keywords=[],
            topics=[]
        )

def extract_keywords(doc) -> List[str]:
    """Extract keywords from document"""
    keywords = []
    
    # Extract noun phrases
    for chunk in doc.noun_chunks:
        if len(chunk.text.split()) <= 3:  # Limit to 3-word phrases
            keywords.append(chunk.text.lower())
    
    # Extract important adjectives + nouns
    for token in doc:
        if token.pos_ in ['NOUN', 'PROPN'] and not token.is_stop:
            keywords.append(token.text.lower())
    
    # Remove duplicates and return top keywords
    keywords = list(set(keywords))[:20]
    return keywords

def extract_topics(doc, concepts: List[Concept]) -> List[str]:
    """Extract main topics from document"""
    topics = []
    
    # Get unique concept texts
    concept_texts = list(set([c.text for c in concepts if c.label in ['TECH', 'ORGANIZATION']]))
    topics.extend(concept_texts[:5])
    
    # Extract frequent noun phrases
    noun_phrases = [chunk.text for chunk in doc.noun_chunks if len(chunk.text.split()) == 2]
    if noun_phrases:
        # Get most frequent
        from collections import Counter
        top_phrases = Counter(noun_phrases).most_common(3)
        topics.extend([phrase for phrase, _ in top_phrases])
    
    return list(set(topics))[:10]