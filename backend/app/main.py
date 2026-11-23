import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.config import settings
from app.core.database import engine, Base
from app.core.logging import logger
from app.api.routes import api_router
from app.schemas.common import APIResponse, ErrorDetail, ErrorCodes

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize database schema & uploads directory
    logger.info("Initializing database tables...")
    Base.metadata.create_all(bind=engine)
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    logger.info("Database and upload storage initialized successfully.")
    yield
    # Shutdown
    logger.info("Application shutting down.")

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="SearchMate API — AI-assisted research paper analysis for college students & beginner researchers",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=r"https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Exception handlers adhering to SearchMate safe error envelope
@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    if isinstance(exc.detail, dict) and "code" in exc.detail:
        code = exc.detail.get("code", ErrorCodes.INTERNAL_ERROR)
        message = exc.detail.get("message", "An error occurred")
    else:
        code = ErrorCodes.INTERNAL_ERROR
        message = str(exc.detail) if exc.detail else "An error occurred"

    return JSONResponse(
        status_code=exc.status_code,
        content=APIResponse(
            success=False,
            error=ErrorDetail(code=code, message=message)
        ).model_dump()
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    error_msgs = []
    for err in exc.errors():
        loc = " -> ".join(str(l) for l in err.get("loc", []))
        error_msgs.append(f"{loc}: {err.get('msg')}")
    combined_message = "; ".join(error_msgs) or "Invalid request parameters"

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content=APIResponse(
            success=False,
            error=ErrorDetail(code="VALIDATION_ERROR", message=combined_message)
        ).model_dump()
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception on {request.url.path}: {exc}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=APIResponse(
            success=False,
            error=ErrorDetail(code=ErrorCodes.INTERNAL_ERROR, message="Something went wrong. Please try again.")
        ).model_dump()
    )

# Health endpoint
@app.get(f"{settings.API_V1_PREFIX}/health", tags=["system"])
def health_check():
    return APIResponse(
        success=True,
        data={
            "status": "healthy",
            "environment": settings.APP_ENV,
            "version": "1.0.0"
        },
        message="SearchMate API is running"
    )

@app.get("/", tags=["system"])
def root():
    return {
        "message": "Welcome to SearchMate API",
        "documentation": "/docs",
        "health": f"{settings.API_V1_PREFIX}/health"
    }

# Register all API routes
app.include_router(api_router, prefix=settings.API_V1_PREFIX)
