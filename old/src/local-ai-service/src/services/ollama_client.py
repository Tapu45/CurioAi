import ollama
from typing import Optional
from src.config import settings
from src.utils.logger import setup_logger

logger = setup_logger()

class OllamaClient:
    def __init__(self):
        self.base_url = settings.OLLAMA_BASE_URL
        self.model = settings.OLLAMA_MODEL
        self.client = ollama.Client(host=self.base_url)
    
    async def generate(self, prompt: str, model: Optional[str] = None) -> str:
        """Generate text using Ollama"""
        try:
            model = model or self.model
            response = self.client.generate(
                model=model,
                prompt=prompt,
                stream=False
            )
            return response.get('response', '')
        except Exception as e:
            logger.error(f"Error generating with Ollama: {e}")
            raise
    
    async def chat(self, messages: list, model: Optional[str] = None) -> str:
        """Chat completion using Ollama"""
        try:
            model = model or self.model
            response = self.client.chat(
                model=model,
                messages=messages,
                stream=False
            )
            return response.get('message', {}).get('content', '')
        except Exception as e:
            logger.error(f"Error in Ollama chat: {e}")
            raise

# Global client instance
ollama_client = OllamaClient()