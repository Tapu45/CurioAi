# CurioAI Local AI Service

Local AI service for content summarization, embedding generation, and concept extraction.

## Setup

1. Install Python dependencies:
pip install -r requirements.txt2. Download spaCy model:
python -m spacy download en_core_web_sm3. Install and start Ollama:
# Install Ollama from https://ollama.ai
ollama pull mistral  # or your preferred model
ollama serve4. Copy `.env.example` to `.env` and configure:sh
cp .env.example .env5. Start the service:
./start.sh
# or
python -m uvicorn src.main:app --reload## API Endpoints

- `GET /health` - Health check
- `POST /api/v1/summarize` - Summarize content
- `POST /api/v1/embedding` - Generate embeddings
- `POST /api/v1/concepts` - Extract concepts
- `POST /api/v1/process` - Process content (all-in-one)

## Testing

curl http://localhost:8000/health