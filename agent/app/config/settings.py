from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Application
    APP_NAME: str
    APP_PHASE: str
    APP_VERSION: str
    APP_URL: str
    FRONTEND_URL: str
    APP_DESCRIPTION: str
    APP_AUTHOR: str
    APP_AUTHOR_EMAIL: str

    # API Keys
    GROQ_API_KEY: str = Field(...)
    FIRECRAWL_API_KEY: str = Field(...)
    TAVILY_API_KEY: str = Field(...)

    # LLM
    GROQ_MODEL: str
    LLM_TEMPERATURE: float
    LLM_MAX_TOKENS: int

    # Research
    TAVILY_MAX_RESULTS: int
    ARXIV_MAX_RESULTS: int
    WIKIPEDIA_MAX_RESULTS: int
    MAX_SOURCES: int
    MAX_CONTENT_LENGTH: int
    MAX_QUERY_LENGTH: int = Field(
        default=2_000,
        ge=1,
        le=10_000,
    )

    # Agents
    MAX_AGENT_ITERATIONS: int = Field(
        default=10,
        ge=1,
        le=50,
    )

    RESEARCH_TIMEOUT_SECONDS: int = Field(
        default=120,
        ge=10,
        le=600,
    )

    # Rate Limiting
    RATE_LIMIT_RESEARCH: int = Field(
        default=10,
        ge=1,
        le=1000,
    )

    RATE_LIMIT_TAVILY: int = Field(
        default=20,
        ge=1,
        le=1000,
    )

    RATE_LIMIT_FIRECRAWL: int = Field(
        default=10,
        ge=1,
        le=1000,
    )

    RATE_LIMIT_ARXIV: int = Field(
        default=10,
        ge=1,
        le=1000,
    )

    RATE_LIMIT_WIKIPEDIA: int = Field(
        default=30,
        ge=1,
        le=1000,
    )

    RATE_LIMIT_WINDOW: int = Field(
        default=60,
        ge=1,
        le=3600,
    )

    # Tool Feature Flags
    ENABLE_TAVILY: bool
    ENABLE_WIKIPEDIA: bool
    ENABLE_ARXIV: bool
    ENABLE_FIRECRAWL: bool

    # Redis
    REDIS_HOST: str
    REDIS_PORT: int
    REDIS_USERNAME: str
    REDIS_PASSWORD: str
    REDIS_DB: int
    CHAT_TTL: int

    # API
    API_PREFIX: str
    HOST: str
    PORT: int

    # CORS
    CORS_ORIGINS: str

    # Logging
    LOG_LEVEL: str

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


settings = get_settings()