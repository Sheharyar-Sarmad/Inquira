import sys
from pathlib import Path

# Adds app directory to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent / "app"))

if __name__ == "__main__":
    import uvicorn
    from config import settings

    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        log_level=settings.LOG_LEVEL.lower(),
        reload=True,
    )