from typing import List, Optional, Any
from datetime import datetime
from pydantic import BaseModel, Field

class PaperBase(BaseModel):
    title: Optional[str] = None
    authors: Optional[List[str]] = Field(default_factory=list)
    publication_year: Optional[int] = None
    abstract: Optional[str] = None

class PaperAnalysisSchema(BaseModel):
    research_problem: Optional[str] = "Not found in paper"
    objective: Optional[str] = "Not found in paper"
    methodology: Optional[str] = "Not found in paper"
    dataset: Optional[str] = "Not found in paper"
    main_findings: List[str] = Field(default_factory=list)
    limitations: List[str] = Field(default_factory=list)
    future_work: List[str] = Field(default_factory=list)
    beginner_explanation: str

class PaperResponse(BaseModel):
    id: str
    collection_id: str
    filename: str
    title: Optional[str] = None
    authors: Optional[List[str]] = Field(default_factory=list)
    publication_year: Optional[int] = None
    abstract: Optional[str] = None
    status: str
    error_code: Optional[str] = None
    analysis: Optional[PaperAnalysisSchema] = None
    page_count: int = 0
    created_at: datetime

    class Config:
        from_attributes = True

class PaperDetailResponse(PaperResponse):
    pass

class PaperCompareRequest(BaseModel):
    paper_ids: List[str] = Field(..., min_length=2, max_length=5)

class PaperCompareItem(BaseModel):
    paper_id: str
    filename: str
    title: str
    authors: List[str]
    publication_year: Optional[int] = None
    objective: str
    methodology: str
    dataset: str
    findings: List[str]
    limitations: List[str]

class DifferenceContext(BaseModel):
    aspect: str  # e.g., 'Dataset', 'Methodology', 'Results'
    description: str
    possible_explanation: str
    status_label: str = "Needs manual verification"

class PaperCompareResponse(BaseModel):
    papers: List[PaperCompareItem]
    common_themes: List[str]
    differences: List[DifferenceContext]
