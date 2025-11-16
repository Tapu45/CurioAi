def get_summarization_prompt(content: str, max_length: int, include_key_points: bool) -> str:
    """Generate summarization prompt"""
    prompt = f"""Please summarize the following content in {max_length} words or less.

Content:
{content}

Please provide:
1. A concise summary
"""
    
    if include_key_points:
        prompt += """2. Key points (3-5 bullet points)
3. Complexity level (beginner/intermediate/advanced)
4. Overall sentiment (positive/neutral/negative)
"""
    else:
        prompt += """2. Complexity level (beginner/intermediate/advanced)
3. Overall sentiment (positive/neutral/negative)
"""
    
    prompt += """
Format your response as:
Summary: [your summary here]

"""
    
    if include_key_points:
        prompt += """Key Points:
- [point 1]
- [point 2]
- [point 3]

"""
    
    prompt += """Complexity: [beginner/intermediate/advanced]
Sentiment: [positive/neutral/negative]
"""
    
    return prompt