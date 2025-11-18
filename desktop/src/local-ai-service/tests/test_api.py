import pytest
from fastapi.testclient import TestClient
from src.main import app

client = TestClient(app)


@pytest.mark.api
class TestHealthEndpoint:
    """Test health check endpoint"""

    def test_health_check(self):
        """Test GET /health endpoint"""
        response = client.get("/health")
        assert response.status_code == 200
        assert "status" in response.json()


@pytest.mark.api
class TestSummarizeEndpoint:
    """Test summarization endpoint"""

    def test_summarize_empty_content(self):
        """Test summarization with empty content"""
        response = client.post(
            "/api/v1/summarize",
            json={"content": "", "max_length": 100}
        )
        # Should handle gracefully
        assert response.status_code in [200, 400]


@pytest.mark.api
class TestEmbeddingEndpoint:
    """Test embedding endpoint"""

    def test_embedding_generation(self):
        """Test embedding generation"""
        response = client.post(
            "/api/v1/embedding",
            json={"text": "test text"}
        )
        # Should return embedding or handle error gracefully
        assert response.status_code in [200, 503]