from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.repositories import CollectionRepository, PaperRepository, AnalysisRepository
from app.schemas.common import APIResponse, ErrorDetail, ErrorCodes
from app.schemas.collection import (
    CollectionCreate,
    CollectionResponse,
    CollectionOverviewResponse,
    ThemeResponse,
    InsightResponse,
    InsightEvidenceResponse
)
from app.schemas.paper import (
    PaperResponse,
    PaperAnalysisSchema,
    PaperCompareRequest,
    PaperCompareResponse,
    PaperCompareItem,
    DifferenceContext
)

router = APIRouter()

@router.post("", response_model=APIResponse[CollectionResponse], status_code=status.HTTP_201_CREATED)
def create_collection(payload: CollectionCreate, db: Session = Depends(get_db)):
    repo = CollectionRepository(db)
    col = repo.create(name=payload.name)
    return APIResponse(
        success=True,
        data=CollectionResponse(
            id=col.id,
            name=col.name,
            created_at=col.created_at,
            updated_at=col.updated_at,
            paper_count=0
        ),
        message="Collection created successfully"
    )

@router.get("", response_model=APIResponse[list[CollectionResponse]])
def list_collections(db: Session = Depends(get_db)):
    repo = CollectionRepository(db)
    cols = repo.list_all()
    results = [
        CollectionResponse(
            id=c.id,
            name=c.name,
            created_at=c.created_at,
            updated_at=c.updated_at,
            paper_count=len(c.papers)
        )
        for c in cols
    ]
    return APIResponse(success=True, data=results)

@router.get("/{collection_id}", response_model=APIResponse[CollectionResponse])
def get_collection(collection_id: str, db: Session = Depends(get_db)):
    repo = CollectionRepository(db)
    col = repo.get_by_id(collection_id)
    if not col:
        raise HTTPException(
            status_code=404,
            detail={"code": ErrorCodes.RESOURCE_NOT_FOUND, "message": "Collection not found"}
        )
    return APIResponse(
        success=True,
        data=CollectionResponse(
            id=col.id,
            name=col.name,
            created_at=col.created_at,
            updated_at=col.updated_at,
            paper_count=len(col.papers)
        )
    )

@router.delete("/{collection_id}", response_model=APIResponse[bool])
def delete_collection(collection_id: str, db: Session = Depends(get_db)):
    repo = CollectionRepository(db)
    success = repo.delete(collection_id)
    if not success:
        raise HTTPException(
            status_code=404,
            detail={"code": ErrorCodes.RESOURCE_NOT_FOUND, "message": "Collection not found"}
        )
    return APIResponse(success=True, data=True, message="Collection and associated data deleted")

@router.get("/{collection_id}/overview", response_model=APIResponse[CollectionOverviewResponse])
def get_collection_overview(collection_id: str, db: Session = Depends(get_db)):
    col_repo = CollectionRepository(db)
    col = col_repo.get_by_id(collection_id)
    if not col:
        raise HTTPException(
            status_code=404,
            detail={"code": ErrorCodes.RESOURCE_NOT_FOUND, "message": "Collection not found"}
        )

    paper_repo = PaperRepository(db)
    papers = paper_repo.get_by_collection(collection_id)

    themes = []
    for t in col.themes:
        p_ids = [p.id for p in t.papers] if t.papers else [p.id for p in papers]
        themes.append(ThemeResponse(
            id=t.id,
            name=t.name,
            description=t.description,
            keywords=t.keywords_json or [],
            paper_ids=p_ids
        ))

    insights = []
    for ins in col.insights:
        evs = [
            InsightEvidenceResponse(
                paper_id=ev.paper_id,
                paper_title=ev.paper.title or ev.paper.filename if ev.paper else "Paper",
                page_number=ev.page_number,
                evidence_text=ev.evidence_text
            )
            for ev in ins.evidences
        ]
        insights.append(InsightResponse(
            id=ins.id,
            type=ins.type,
            title=ins.title,
            description=ins.description,
            confidence_label=ins.confidence_label,
            evidences=evs
        ))

    papers_response = []
    for p in papers:
        an_schema = None
        if p.analysis:
            an_schema = PaperAnalysisSchema(
                research_problem=p.analysis.research_problem,
                objective=p.analysis.objective,
                methodology=p.analysis.methodology,
                dataset=p.analysis.dataset,
                main_findings=p.analysis.main_findings_json or [],
                limitations=p.analysis.limitations_json or [],
                future_work=p.analysis.future_work_json or [],
                beginner_explanation=p.analysis.beginner_explanation
            )
        papers_response.append(PaperResponse(
            id=p.id,
            collection_id=p.collection_id,
            filename=p.filename,
            title=p.title,
            authors=p.authors_json or [],
            publication_year=p.publication_year,
            abstract=p.abstract,
            status=p.status,
            error_code=p.error_code,
            analysis=an_schema,
            page_count=len(p.pages) if p.pages else 0,
            created_at=p.created_at
        ))

    summary = (
        f"This collection contains {len(papers)} research papers. "
        + (f"{len(themes)} shared themes have been synthesized." if themes else "Processing in progress...")
    )

    overview = CollectionOverviewResponse(
        id=col.id,
        name=col.name,
        created_at=col.created_at,
        updated_at=col.updated_at,
        papers=papers_response,
        themes=themes,
        insights=insights,
        collection_summary=summary
    )
    return APIResponse(success=True, data=overview)

@router.post("/{collection_id}/compare", response_model=APIResponse[PaperCompareResponse])
def compare_papers(collection_id: str, payload: PaperCompareRequest, db: Session = Depends(get_db)):
    paper_repo = PaperRepository(db)
    selected_papers = []
    for pid in payload.paper_ids:
        p = paper_repo.get_by_id(pid)
        if p and p.collection_id == collection_id:
            selected_papers.append(p)

    if len(selected_papers) < 2:
        raise HTTPException(
            status_code=400,
            detail={"code": "INVALID_SELECTION", "message": "At least 2 valid papers from this collection are required for comparison"}
        )

    compare_items = []
    for p in selected_papers:
        an = p.analysis
        compare_items.append(PaperCompareItem(
            paper_id=p.id,
            filename=p.filename,
            title=p.title or p.filename,
            authors=p.authors_json or ["Not found in paper"],
            publication_year=p.publication_year,
            objective=an.objective if an and an.objective else "Not found in paper",
            methodology=an.methodology if an and an.methodology else "Not found in paper",
            dataset=an.dataset if an and an.dataset else "Not found in paper",
            findings=an.main_findings_json if an and an.main_findings_json else ["Not found in paper"],
            limitations=an.limitations_json if an and an.limitations_json else ["Not found in paper"]
        ))

    # Formulate contextual differences safely
    differences = []
    p1 = selected_papers[0]
    p2 = selected_papers[1]
    
    # Dataset comparison
    d1 = p1.analysis.dataset if p1.analysis else "Not found"
    d2 = p2.analysis.dataset if p2.analysis else "Not found"
    if d1 != d2:
        differences.append(DifferenceContext(
            aspect="Target Dataset / Domain",
            description=f"'{p1.title or p1.filename}' evaluates on '{d1}', whereas '{p2.title or p2.filename}' utilizes '{d2}'.",
            possible_explanation="Different problem formulations or empirical benchmarks may explain differing performance metrics.",
            status_label="Needs manual verification"
        ))

    # Methodology comparison
    m1 = p1.analysis.methodology if p1.analysis else "Not found"
    m2 = p2.analysis.methodology if p2.analysis else "Not found"
    if m1 != m2:
        differences.append(DifferenceContext(
            aspect="Methodological Approach",
            description=f"First study emphasizes '{m1[:80]}...', while the second emphasizes '{m2[:80]}...'.",
            possible_explanation="Distinct architectural or experimental designs were selected based on the specific constraints of each paper.",
            status_label="Needs manual verification"
        ))

    common_themes = ["Experimental benchmarking", "Iterative evaluation"]

    return APIResponse(
        success=True,
        data=PaperCompareResponse(
            papers=compare_items,
            common_themes=common_themes,
            differences=differences
        )
    )
