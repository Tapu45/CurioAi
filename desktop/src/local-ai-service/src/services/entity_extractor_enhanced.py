"""
Enhanced Entity Extraction with tier-based models
Uses existing spaCy models, adds optional BERT NER for HIGH_END/PREMIUM
"""
import spacy
from typing import List, Dict, Optional
from src.api.schemas import ExtractConceptsResponse, Concept
from src.config import settings
from src.services.model_manager import get_model_manager
from src.utils.logger import setup_logger
import re

logger = setup_logger()

# Global model instances
_nlp_model = None
_bert_ner_model = None

def get_nlp_model():
    """Get or load spaCy model based on tier"""
    global _nlp_model
    if _nlp_model is None:
        model_manager = get_model_manager()
        tier = model_manager.get_recommended_tier() if not settings.MODEL_TIER else settings.MODEL_TIER
        
        # Get model for tier
        tier_config = model_manager._get_models_for_tier(tier)
        model_name = tier_config.get('nlp', 'en_core_web_sm')
        
        try:
            logger.info(f"Loading spaCy model: {model_name}")
            _nlp_model = spacy.load(model_name)
            logger.info(f"spaCy model loaded: {model_name}")
        except OSError:
            logger.error(f"spaCy model {model_name} not found. Please install it with: python -m spacy download {model_name}")
            raise
    
    return _nlp_model

def get_bert_ner_model():
    """Get BERT NER model for HIGH_END/PREMIUM tiers (optional enhancement)"""
    global _bert_ner_model
    
    model_manager = get_model_manager()
    tier = model_manager.get_recommended_tier() if not settings.MODEL_TIER else settings.MODEL_TIER
    
    # Only use BERT NER for HIGH_END and PREMIUM
    if tier not in ['HIGH_END', 'PREMIUM']:
        return None
    
    if _bert_ner_model is None:
        try:
            from transformers import pipeline
            logger.info("Loading BERT NER model for enhanced entity extraction")
            _bert_ner_model = pipeline(
                "ner",
                model="dslim/bert-base-NER",
                aggregation_strategy="simple"
            )
            logger.info("BERT NER model loaded")
        except Exception as e:
            logger.warning(f"Could not load BERT NER model: {e}. Using spaCy only.")
            return None
    
    return _bert_ner_model

async def extract_entities_enhanced(
    text: str,
    min_confidence: float = 0.5,
    extract_types: Optional[List[str]] = None
) -> ExtractConceptsResponse:
    """
    Extract entities using enhanced NER (spaCy + optional BERT)
    
    extract_types: List of entity types to extract:
        - 'movie', 'game', 'book', 'topic', 'project', 'pdf', 'video', 'person', 'location'
    """
    try:
        nlp = get_nlp_model()
        doc = nlp(text)
        
        # Extract with spaCy
        concepts = []
        for ent in doc.ents:
            label = map_spacy_label(ent.label_)
            
            # Filter by extract_types if specified
            if extract_types and label not in extract_types:
                continue
            
            concepts.append(Concept(
                text=ent.text,
                label=label,
                confidence=0.8,  # spaCy default
                start=ent.start_char,
                end=ent.end_char
            ))
        
        # Enhance with BERT NER if available
        bert_model = get_bert_ner_model()
        if bert_model:
            try:
                bert_entities = bert_model(text)
                for entity in bert_entities:
                    label = map_bert_label(entity['entity_group'])
                    
                    # Filter by extract_types if specified
                    if extract_types and label not in extract_types:
                        continue
                    
                    # Check if not already extracted by spaCy
                    if not any(c.text == entity['word'] and c.label == label for c in concepts):
                        concepts.append(Concept(
                            text=entity['word'],
                            label=label,
                            confidence=entity.get('score', 0.8),
                            start=entity.get('start', 0),
                            end=entity.get('end', len(entity['word']))
                        ))
            except Exception as e:
                logger.debug(f"BERT NER error: {e}")
        
        # Extract specialized entities (movies, games, books, etc.)
        specialized = extract_specialized_entities(text, extract_types)
        concepts.extend(specialized)
        
        # Extract keywords and topics
        keywords = extract_keywords(doc)
        topics = extract_topics(doc, concepts)
        
        return ExtractConceptsResponse(
            concepts=concepts,
            keywords=keywords,
            topics=topics
        )
    except Exception as e:
        logger.error(f"Error extracting entities: {e}")
        return ExtractConceptsResponse(
            concepts=[],
            keywords=[],
            topics=[]
        )

def map_spacy_label(spacy_label: str) -> str:
    """Map spaCy labels to our entity types"""
    label_map = {
        'PERSON': 'PERSON',
        'ORG': 'ORGANIZATION',
        'GPE': 'LOCATION',
        'PRODUCT': 'TECH',
        'MONEY': 'OTHER',
        'DATE': 'OTHER',
    }
    return label_map.get(spacy_label, 'OTHER')

def map_bert_label(bert_label: str) -> str:
    """Map BERT NER labels to our entity types"""
    label_map = {
        'PER': 'PERSON',
        'ORG': 'ORGANIZATION',
        'LOC': 'LOCATION',
        'MISC': 'OTHER',
    }
    return label_map.get(bert_label, 'OTHER')

def extract_specialized_entities(text: str, extract_types: Optional[List[str]] = None) -> List[Concept]:
    """Extract specialized entities like movies, games, books using patterns"""
    entities = []
    text_lower = text.lower()
    
    # Movie patterns
    if not extract_types or 'movie' in extract_types or 'video' in extract_types:
        movie_patterns = [
            r'watched\s+["\']([^"\']+)["\']',
            r'movie[:\s]+["\']?([^"\'\n]+)["\']?',
            r'film[:\s]+["\']?([^"\'\n]+)["\']?',
        ]
        for pattern in movie_patterns:
            matches = re.finditer(pattern, text_lower, re.IGNORECASE)
            for match in matches:
                entities.append(Concept(
                    text=match.group(1).strip(),
                    label='MOVIE',
                    confidence=0.7,
                    start=match.start(),
                    end=match.end()
                ))
    
    # Game patterns
    if not extract_types or 'game' in extract_types:
        game_patterns = [
            r'playing\s+["\']([^"\']+)["\']',
            r'game[:\s]+["\']?([^"\'\n]+)["\']?',
        ]
        for pattern in game_patterns:
            matches = re.finditer(pattern, text_lower, re.IGNORECASE)
            for match in matches:
                entities.append(Concept(
                    text=match.group(1).strip(),
                    label='GAME',
                    confidence=0.7,
                    start=match.start(),
                    end=match.end()
                ))
    
    # Book/PDF patterns
    if not extract_types or 'book' in extract_types or 'pdf' in extract_types:
        book_patterns = [
            r'reading\s+["\']([^"\']+)["\']',
            r'book[:\s]+["\']?([^"\'\n]+)["\']?',
            r'pdf[:\s]+["\']?([^"\'\n]+)["\']?',
        ]
        for pattern in book_patterns:
            matches = re.finditer(pattern, text_lower, re.IGNORECASE)
            for match in matches:
                entities.append(Concept(
                    text=match.group(1).strip(),
                    label='BOOK',
                    confidence=0.7,
                    start=match.start(),
                    end=match.end()
                ))
    
    # Project patterns
    if not extract_types or 'project' in extract_types:
        project_patterns = [
            r'project[:\s]+["\']?([^"\'\n]+)["\']?',
            r'working\s+on\s+["\']?([^"\'\n]+)["\']?',
        ]
        for pattern in project_patterns:
            matches = re.finditer(pattern, text_lower, re.IGNORECASE)
            for match in matches:
                entities.append(Concept(
                    text=match.group(1).strip(),
                    label='PROJECT',
                    confidence=0.7,
                    start=match.start(),
                    end=match.end()
                ))
    
    return entities

def extract_keywords(doc) -> List[str]:
    """Extract keywords from document"""
    keywords = []
    
    for chunk in doc.noun_chunks:
        if len(chunk.text.split()) <= 3:
            keywords.append(chunk.text.lower())
    
    for token in doc:
        if token.pos_ in ['NOUN', 'PROPN'] and not token.is_stop:
            keywords.append(token.text.lower())
    
    return list(set(keywords))[:20]

def extract_topics(doc, concepts: List[Concept]) -> List[str]:
    """Extract main topics from document"""
    topics = []
    
    concept_texts = list(set([c.text for c in concepts if c.label in ['TECH', 'ORGANIZATION', 'PROJECT']]))
    topics.extend(concept_texts[:5])
    
    noun_phrases = [chunk.text for chunk in doc.noun_chunks if len(chunk.text.split()) == 2]
    if noun_phrases:
        from collections import Counter
        top_phrases = Counter(noun_phrases).most_common(3)
        topics.extend([phrase for phrase, _ in top_phrases])
    
    return list(set(topics))[:10]