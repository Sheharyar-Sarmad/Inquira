from typing import Any, Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request, status
from pydantic import BaseModel, Field, field_validator

from services.rate_limiter import RateLimitExceeded
from services.research import (
    get_research_job,
    process_research,
    run_research_job,
    start_research_job,
)


router = APIRouter(
    prefix="/research",
    tags=["Research"],
)


class ResearchRequest(BaseModel):
    conversation_id: str = Field(..., min_length=1, max_length=100)
    query: str = Field(..., min_length=1, max_length=10_000)

    @field_validator("conversation_id")
    @classmethod
    def validate_conversation_id(cls, value: str) -> str:
        return value.strip()

    @field_validator("query")
    @classmethod
    def validate_query(cls, value: str) -> str:
        value = " ".join(value.strip().split())

        if not value:
            raise ValueError("Research query cannot be empty.")

        return value


class ToolCall(BaseModel):
    name: str
    input: dict[str, Any] = Field(default_factory=dict)


class ResearchResponse(BaseModel):
    conversation_id: str
    answer: str
    request_id: str
    tools_used: list[ToolCall] = Field(default_factory=list)
    cached: bool = False


class JobCreatedResponse(BaseModel):
    job_id: str
    conversation_id: str
    status: str = "pending"


class JobStatusResponse(BaseModel):
    job_id: str
    conversation_id: str
    status: str
    answer: Optional[str] = None
    tools_used: list[ToolCall] = Field(default_factory=list)
    cached: bool = False
    error: Optional[str] = None


def get_client_ip(http_request: Request) -> str:
    return http_request.client.host if http_request.client else "unknown"


def to_http_error(err: Exception) -> HTTPException:
    if isinstance(err, ValueError):
        return HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(err),
        )

    if isinstance(err, RateLimitExceeded):
        return HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=str(err),
            headers={"Retry-After": "60"},
        )

    if isinstance(err, TimeoutError):
        return HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail=str(err),
        )

    message = str(err)
    lowered = message.lower()

    if "storage" in lowered or "rate limiting" in lowered:
        code = status.HTTP_503_SERVICE_UNAVAILABLE
    else:
        code = status.HTTP_502_BAD_GATEWAY

    return HTTPException(status_code=code, detail=message)


@router.post(
    "",
    response_model=ResearchResponse,
    status_code=status.HTTP_200_OK,
)
async def research(
    request: ResearchRequest,
    http_request: Request,
) -> ResearchResponse:
    try:
        result = await process_research(
            conversation_id=request.conversation_id,
            query=request.query,
            client_ip=get_client_ip(http_request),
        )
        return ResearchResponse(**result)

    except (ValueError, RateLimitExceeded, TimeoutError, RuntimeError) as err:
        raise to_http_error(err) from err


@router.post(
    "/async",
    response_model=JobCreatedResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def research_async(
    request: ResearchRequest,
    http_request: Request,
    background_tasks: BackgroundTasks,
) -> JobCreatedResponse:
    try:
        job = start_research_job(
            conversation_id=request.conversation_id,
            query=request.query,
            client_ip=get_client_ip(http_request),
        )
    except (ValueError, RateLimitExceeded, RuntimeError) as err:
        raise to_http_error(err) from err

    background_tasks.add_task(
        run_research_job,
        job["job_id"],
        job["conversation_id"],
        job["query"],
    )

    return JobCreatedResponse(
        job_id=job["job_id"],
        conversation_id=job["conversation_id"],
    )


@router.get(
    "/jobs/{job_id}",
    response_model=JobStatusResponse,
    status_code=status.HTTP_200_OK,
)
async def research_job_status(job_id: str) -> JobStatusResponse:
    try:
        job = get_research_job(job_id)
    except (ValueError, RuntimeError) as err:
        raise to_http_error(err) from err

    if job is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found or expired.",
        )

    return JobStatusResponse(**job)