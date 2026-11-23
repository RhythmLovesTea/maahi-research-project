import os
import shutil
import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks, status
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.database import get_db, SessionLocal
from app.core.logging import logger
from app.repositories import CollectionRepository, PaperRepository, AnalysisRepository
from app.schemas.common import APIResponse, ErrorDetail, ErrorCodes
from app.schemas.paper import PaperResponse, PaperDetailResponse, PaperAnalysisSchema
from app.services.pdf_service import PDFService
from app.services.ai.provider_factory import get_ai_provider
from app.services.relationship_service import RelationshipService
from app.services.research_idea_service import ResearchIdeaService

router = APIRouter()

def process_paper_task(paper_id: str, collection_id: str, file_path: str):
    """
    Background processing task:
    1. Validates PDF
    2. Extracts page-by-page text
    3. Saves pages and retrievable chunks
    4. Executes AI/heuristic analysis
    5. Updates paper status to 'completed'
    6. Updates cross-paper collection themes & insights
    """
    db = SessionLocal()
    paper_repo = PaperRepository(db)
    analysis_repo = AnalysisRepository(db)
    try:
        # Step 1: Validating
        paper_repo.update_status(paper_id, "validating")
        valid, err = PDFService.validate_file(file_path, settings.MAX_FILE_SIZE_MB)
        if not valid:
            paper_repo.update_status(paper_id, "failed", err)
            return

        # Step 2: Extracting
        paper_repo.update_status(paper_id, "extracting")
        pages, err, full_text = PDFService.extract_text_and_pages(file_path)
        if err or not pages:
            paper_repo.update_status(paper_id, "failed", err or ErrorCodes.PDF_TEXT_NOT_FOUND)
            return

        # Save pages and retrievable chunks
        paper_repo.save_pages(paper_id, pages)
        chunks = PDFService.chunk_pages(pages)
        paper_repo.save_chunks(paper_id, chunks)

        # Step 3: Analysing
        paper_repo.update_status(paper_id, "analysing")
        ai_provider = get_ai_provider()
        paper = paper_repo.get_by_id(paper_id)
        filename = paper.filename if paper else "document.pdf"
        
        try:
            analysis_data = ai_provider.analyze_paper(full_text, filename)
        except Exception as ai_err:
            logger.warning(f"AI Provider failed for {paper_id}: {ai_err}. Falling back to HeuristicProvider.")
            from app.services.ai.heuristic_provider import HeuristicProvider
            analysis_data = HeuristicProvider().analyze_paper(full_text, filename)
        
        # Update paper metadata
        paper_repo.update_metadata(
            paper_id=paper_id,
            title=analysis_data.get("title") or filename.replace(".pdf", ""),
            authors=analysis_data.get("authors") or [],
            publication_year=analysis_data.get("publication_year"),
            abstract=analysis_data.get("abstract") or "Not found in paper"
        )

        # Save analysis
        analysis_repo.save_paper_analysis(
            paper_id=paper_id,
            analysis_data={
                "research_problem": analysis_data.get("research_problem") or "Not found in paper",
                "objective": analysis_data.get("objective") or "Not found in paper",
                "methodology": analysis_data.get("methodology") or "Not found in paper",
                "dataset": analysis_data.get("dataset") or "Not found in paper",
                "main_findings_json": analysis_data.get("main_findings") or [],
                "limitations_json": analysis_data.get("limitations") or [],
                "future_work_json": analysis_data.get("future_work") or [],
                "beginner_explanation": analysis_data.get("beginner_explanation") or "Overview available."
            }
        )

        paper_repo.update_status(paper_id, "completed")

        # Step 4: Refresh collection cross-paper themes and insights
        try:
            all_papers = paper_repo.get_by_collection(collection_id)
            completed_papers = [p for p in all_papers if p.status == "completed"]
            
            if completed_papers:
                themes = RelationshipService.extract_collection_themes(completed_papers)
                analysis_repo.replace_collection_themes(collection_id, themes)

                insights = ResearchIdeaService.generate_insights_and_gaps(completed_papers)
                analysis_repo.replace_collection_insights(collection_id, insights)
        except Exception as theme_err:
            logger.warning(f"Theme/Insight refresh failed for collection {collection_id}: {theme_err}")

    except Exception as e:
        logger.error(f"Error processing paper {paper_id}: {e}")
        paper_repo.update_status(paper_id, "failed", ErrorCodes.INTERNAL_ERROR)
    finally:
        db.close()

@router.post("/collections/{collection_id}/papers", response_model=APIResponse[PaperResponse], status_code=status.HTTP_202_ACCEPTED)
async def upload_paper(
    collection_id: str,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    col_repo = CollectionRepository(db)
    col = col_repo.get_by_id(collection_id)
    if not col:
        raise HTTPException(status_code=404, detail={"code": ErrorCodes.RESOURCE_NOT_FOUND, "message": "Collection not found"})

    paper_repo = PaperRepository(db)
    existing_papers = paper_repo.get_by_collection(collection_id)
    if len(existing_papers) >= settings.MAX_PAPERS_PER_COLLECTION:
        raise HTTPException(
            status_code=400,
            detail={"code": ErrorCodes.PAPER_LIMIT_REACHED, "message": f"Collection reached maximum limit of {settings.MAX_PAPERS_PER_COLLECTION} papers."}
        )

    # Validate filename extension
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=400,
            detail={"code": ErrorCodes.INVALID_FILE_TYPE, "message": "Only PDF files are supported. Please upload a PDF research paper."}
        )

    # Prepare storage directory
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    safe_filename = f"{uuid.uuid4()}_{os.path.basename(file.filename)}"
    storage_path = os.path.join(settings.UPLOAD_DIR, safe_filename)

    # Save uploaded file
    try:
        with open(storage_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        logger.error(f"Failed to save upload: {e}")
        raise HTTPException(status_code=500, detail={"code": ErrorCodes.INTERNAL_ERROR, "message": "Failed to save file."})

    # Create paper record
    paper = paper_repo.create(
        collection_id=collection_id,
        filename=file.filename,
        storage_path=storage_path
    )

    # Queue background processing
    background_tasks.add_task(process_paper_task, paper.id, collection_id, storage_path)

    return APIResponse(
        success=True,
        data=PaperResponse(
            id=paper.id,
            collection_id=paper.collection_id,
            filename=paper.filename,
            title=paper.title,
            authors=paper.authors_json or [],
            publication_year=paper.publication_year,
            abstract=paper.abstract,
            status=paper.status,
            error_code=paper.error_code,
            created_at=paper.created_at
        ),
        message="PDF uploaded and queued for processing"
    )

@router.get("/collections/{collection_id}/papers", response_model=APIResponse[List[PaperResponse]])
def list_papers(collection_id: str, db: Session = Depends(get_db)):
    paper_repo = PaperRepository(db)
    papers = paper_repo.get_by_collection(collection_id)
    results = [
        PaperResponse(
            id=p.id,
            collection_id=p.collection_id,
            filename=p.filename,
            title=p.title,
            authors=p.authors_json or [],
            publication_year=p.publication_year,
            abstract=p.abstract,
            status=p.status,
            error_code=p.error_code,
            created_at=p.created_at
        )
        for p in papers
    ]
    return APIResponse(success=True, data=results)

@router.get("/papers/{paper_id}", response_model=APIResponse[PaperDetailResponse])
def get_paper_detail(paper_id: str, db: Session = Depends(get_db)):
    paper_repo = PaperRepository(db)
    paper = paper_repo.get_by_id(paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail={"code": ErrorCodes.RESOURCE_NOT_FOUND, "message": "Paper not found"})

    analysis_schema = None
    if paper.analysis:
        an = paper.analysis
        analysis_schema = PaperAnalysisSchema(
            research_problem=an.research_problem or "Not found in paper",
            objective=an.objective or "Not found in paper",
            methodology=an.methodology or "Not found in paper",
            dataset=an.dataset or "Not found in paper",
            main_findings=an.main_findings_json or [],
            limitations=an.limitations_json or [],
            future_work=an.future_work_json or [],
            beginner_explanation=an.beginner_explanation
        )

    detail = PaperDetailResponse(
        id=paper.id,
        collection_id=paper.collection_id,
        filename=paper.filename,
        title=paper.title,
        authors=paper.authors_json or [],
        publication_year=paper.publication_year,
        abstract=paper.abstract,
        status=paper.status,
        error_code=paper.error_code,
        created_at=paper.created_at,
        analysis=analysis_schema,
        page_count=len(paper.pages)
    )
    return APIResponse(success=True, data=detail)

@router.get("/papers/{paper_id}/status", response_model=APIResponse[dict])
def get_paper_status(paper_id: str, db: Session = Depends(get_db)):
    paper_repo = PaperRepository(db)
    paper = paper_repo.get_by_id(paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail={"code": ErrorCodes.RESOURCE_NOT_FOUND, "message": "Paper not found"})

    return APIResponse(
        success=True,
        data={
            "paper_id": paper.id,
            "status": paper.status,
            "error_code": paper.error_code
        }
    )

@router.delete("/papers/{paper_id}", response_model=APIResponse[bool])
def delete_paper(paper_id: str, db: Session = Depends(get_db)):
    paper_repo = PaperRepository(db)
    paper = paper_repo.get_by_id(paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail={"code": ErrorCodes.RESOURCE_NOT_FOUND, "message": "Paper not found"})

    # Remove file on disk
    if os.path.exists(paper.storage_path):
        try:
            os.remove(paper.storage_path)
        except Exception as e:
            logger.warning(f"Could not remove physical file {paper.storage_path}: {e}")

    paper_repo.delete(paper_id)
    return APIResponse(success=True, data=True, message="Paper deleted successfully")
