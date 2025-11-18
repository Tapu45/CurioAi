import ollama
from typing import Optional, Dict, Any, List
from src.config import settings
from src.utils.logger import setup_logger
import base64
from PIL import Image
import io

logger = setup_logger()

class VisionModel:
    def __init__(self):
        self.client = ollama.Client(host=settings.OLLAMA_BASE_URL)
        self.model = "llava"  # Default vision model, can be changed
    
    async def describe_image(self, image_path: str, prompt: Optional[str] = None) -> Dict[str, Any]:
        """
        Describe image using vision model (LLaVA/BLIP)
        
        Args:
            image_path: Path to image file
            prompt: Optional custom prompt
        
        Returns:
            Dictionary with scene description
        """
        try:
            default_prompt = "Describe this image in detail. Include objects, text, and context."
            user_prompt = prompt or default_prompt
            
            # Read image
            with open(image_path, 'rb') as f:
                image_bytes = f.read()
            
            # Convert to base64
            image_base64 = base64.b64encode(image_bytes).decode('utf-8')
            
            # Call Ollama with vision model
            response = self.client.generate(
                model=self.model,
                prompt=user_prompt,
                images=[image_base64],
                stream=False
            )
            
            description = response.get('response', '')
            
            return {
                'description': description,
                'model': self.model,
                'method': 'vision-model'
            }
        except Exception as e:
            logger.error(f"Error describing image {image_path}: {e}")
            # Fallback: return basic info
            return {
                'description': 'Unable to analyze image',
                'error': str(e),
                'method': 'vision-model'
            }
    
    async def detect_objects(self, image_path: str) -> List[str]:
        """
        Detect objects in image
        
        Args:
            image_path: Path to image file
        
        Returns:
            List of detected objects
        """
        try:
            prompt = "List all objects you can see in this image. Return only a comma-separated list."
            
            result = await self.describe_image(image_path, prompt)
            description = result.get('description', '')
            
            # Parse comma-separated list
            objects = [obj.strip() for obj in description.split(',') if obj.strip()]
            
            return objects
        except Exception as e:
            logger.error(f"Error detecting objects in {image_path}: {e}")
            return []

# Global instance
_vision_model = None

def get_vision_model():
    """Get vision model instance"""
    global _vision_model
    if _vision_model is None:
        _vision_model = VisionModel()
    return _vision_model