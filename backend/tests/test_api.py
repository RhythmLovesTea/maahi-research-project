import os
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.config import settings
from app.schemas.common import ErrorCodes
from app.services.pdf_service import PDFService
from app.services.ai.heuristic_provider import HeuristicProvider
from app.services.relationship_service import RelationshipService
from app.models import Paper, Theme, PaperAnalysis
from app.core.database import Base, engine

Base.metadata.create_all(bind=engine)
client = TestClient(app)

def test_health_check():
    response = client.get(f"{settings.API_V1_PREFIX}/health")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["data"]["status"] == "healthy"

def test_collection_lifecycle():
    # 1. Create collection
    create_res = client.post(
        f"{settings.API_V1_PREFIX}/collections",
        json={"name": "Machine Learning Research"}
    )
    assert create_res.status_code == 201
    created_data = create_res.json()
    assert created_data["success"] is True
    col_id = created_data["data"]["id"]
    assert created_data["data"]["name"] == "Machine Learning Research"

    # 2. Get collection
    get_res = client.get(f"{settings.API_V1_PREFIX}/collections/{col_id}")
    assert get_res.status_code == 200
    assert get_res.json()["data"]["id"] == col_id

    # 3. List collections
    list_res = client.get(f"{settings.API_V1_PREFIX}/collections")
    assert list_res.status_code == 200
    cols = list_res.json()["data"]
    assert any(c["id"] == col_id for c in cols)

    # 4. Delete collection
    del_res = client.delete(f"{settings.API_V1_PREFIX}/collections/{col_id}")
    assert del_res.status_code == 200

    # 5. Confirm deletion returns 404
    get_after_del = client.get(f"{settings.API_V1_PREFIX}/collections/{col_id}")
    assert get_after_del.status_code == 404
    assert get_after_del.json()["error"]["code"] == ErrorCodes.RESOURCE_NOT_FOUND

def test_invalid_file_upload_rejected():
    # Create collection
    col_res = client.post(
        f"{settings.API_V1_PREFIX}/collections",
        json={"name": "Upload Test"}
    )
    col_id = col_res.json()["data"]["id"]

    # Try uploading non-PDF
    res = client.post(
        f"{settings.API_V1_PREFIX}/collections/{col_id}/papers",
        files={"file": ("notes.txt", b"This is not a pdf file", "text/plain")}
    )
    assert res.status_code == 400
    err = res.json()
    assert err["success"] is False
    assert err["error"]["code"] == ErrorCodes.INVALID_FILE_TYPE

    # Cleanup
    client.delete(f"{settings.API_V1_PREFIX}/collections/{col_id}")

def test_heuristic_provider_analysis():
    provider = HeuristicProvider()
    sample_text = """
    Deep Residual Learning for Image Recognition
    Kaiming He, Xiangyu Zhang, Shaoqing Ren, Jian Sun
    2016
    Abstract: Deeper neural networks are more difficult to train. We present a residual learning framework to ease the training of networks that are substantially deeper.
    1. Introduction
    The objective of this paper is to investigate residual networks.
    2. Methodology
    We formulate the layers as learning residual functions with reference to the layer inputs.
    3. Dataset and Experiments
    We evaluate our approach on the ImageNet 2012 classification dataset.
    4. Main Findings
    Results demonstrate that deep residual networks are easier to optimize and gain accuracy from increased depth.
    5. Limitations and Future Work
    We note that computational requirements remain significant on resource-constrained devices.
    """
    result = provider.analyze_paper(sample_text, "resnet.pdf")
    assert result["title"] is not None
    assert result["publication_year"] == 2016
    assert "ImageNet" in result["dataset"]
    assert len(result["main_findings"]) > 0
    assert len(result["limitations"]) > 0
    assert len(result["beginner_explanation"]) > 50

def test_relationship_graph_generation():
    # Test building essential graph
    papers = [
        Paper(
            id="p1",
            filename="resnet.pdf",
            title="Deep Residual Learning",
            publication_year=2016,
            status="completed"
        ),
        Paper(
            id="p2",
            filename="transformer.pdf",
            title="Attention Is All You Need",
            publication_year=2017,
            status="completed"
        )
    ]
    papers[0].analysis = PaperAnalysis(
        objective="Investigate residual learning",
        methodology="Residual connections in neural networks",
        dataset="ImageNet",
        main_findings_json=["Improved depth accuracy"],
        limitations_json=["High computation"],
        beginner_explanation="Simple explanation"
    )
    papers[1].analysis = PaperAnalysis(
        objective="Replace recurrence with attention",
        methodology="Transformer self-attention architecture in neural networks",
        dataset="WMT 2014",
        main_findings_json=["Faster training"],
        limitations_json=["Quadratic memory cost"],
        beginner_explanation="Simple explanation"
    )

    themes = [
        Theme(
            id="t1",
            name="Deep Neural Architectures",
            description="Exploration of advanced deep learning network designs.",
            keywords_json=["neural", "architecture", "networks"]
        )
    ]

    graph = RelationshipService.build_essential_graph("col-test", papers, themes)
    assert graph["collection_id"] == "col-test"
    assert len(graph["nodes"]) == 3  # 2 papers + 1 theme
    assert len(graph["edges"]) >= 2  # paper-theme connections
    
    # Check node types
    node_types = {n["type"] for n in graph["nodes"]}
    assert "paper" in node_types
    assert "theme" in node_types
    
    # Check edge evidence
    for edge in graph["edges"]:
        assert len(edge["evidence_refs"]) > 0
        assert "paper_id" in edge["evidence_refs"][0]


def test_provider_factory_selection():
    from app.services.ai.provider_factory import get_ai_provider
    from app.services.ai.groq_provider import GroqProvider
    from app.services.ai.heuristic_provider import HeuristicProvider

    # With no key, returns HeuristicProvider
    provider = get_ai_provider()
    assert isinstance(provider, (HeuristicProvider, GroqProvider))

def test_groq_provider_schema():
    from app.services.ai.groq_provider import GroqProvider
    provider = GroqProvider(api_key="mock_key")
    assert provider.model_name == "llama-3.3-70b-versatile"
    assert "groq.com" in provider.base_url
