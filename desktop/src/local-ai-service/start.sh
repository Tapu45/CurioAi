#!/bin/bash

# Activate virtual environment if it exists
if [ -d "venv" ]; then
    source venv/bin/activate
fi

# Check if Ollama is running
if ! curl -s http://localhost:11434/api/tags > /dev/null; then
    echo "Warning: Ollama doesn't seem to be running on localhost:11434"
    echo "Please start Ollama first: ollama serve"
fi

# Start the FastAPI service
python -m uvicorn src.main:app --host 127.0.0.1 --port 8000 --reload