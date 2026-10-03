from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Remove 'app.' prefix so imports match the added sys.path root
from config import settings
from routes.research_route import router as research_router

app: FastAPI = FastAPI(
    title=settings.APP_NAME,
    description=settings.APP_DESCRIPTION,
    version=settings.APP_VERSION,
    openapi_url=f"{settings.API_PREFIX}/openapi.json",
    docs_url=f"{settings.API_PREFIX}/docs",
    redoc_url=f"{settings.API_PREFIX}/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(
    research_router,
    prefix=settings.API_PREFIX,
)

@app.get("/")
def root() -> dict[str, str]:
    return {
        "message": f"Welcome to the {settings.APP_NAME} API!"
    }

@app.get("/health")
async def health_check() -> dict[str, str]:
    return {
        "status": "ok",
        "service": settings.APP_NAME,
    }