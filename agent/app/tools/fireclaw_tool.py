import logging
from functools import lru_cache

from firecrawl import FirecrawlApp
from langchain.tools import tool

from config import settings
from services.rate_limiter import (
    RateLimitExceeded,
    rate_limiter,
)


logger = logging.getLogger(__name__)


if not settings.ENABLE_FIRECRAWL:
    raise RuntimeError(
        "Firecrawl tool is disabled. Please enable it in the settings to use this feature."
    )


firecrawl: FirecrawlApp = FirecrawlApp(
    api_key=settings.FIRECRAWL_API_KEY
)


MAX_SCRAPE_CHARS: int = 4000

@lru_cache(maxsize=100)
def scrape_url(url: str) -> str:
    result = firecrawl.scrape(
        url,
        formats=["markdown"],
    )

    if hasattr(result, "markdown"):
        content = result.markdown or ""
    elif isinstance(result, dict):
        content = result.get("markdown", "")
    else:
        content = str(result)

    return content[:MAX_SCRAPE_CHARS]

@tool
def get_firecrawl_tool(url: str) -> str:
    """
    Scrape a webpage using Firecrawl and return its content as Markdown.
    """

    try:
        if not url or not url.strip():
            raise ValueError(
                "URL cannot be empty."
            )

        url = url.strip()

        if len(url) > settings.MAX_QUERY_LENGTH:
            raise ValueError(
                f"URL length exceeds the maximum allowed "
                f"length of {settings.MAX_QUERY_LENGTH} characters."
            )

        if not url.startswith(("http://", "https://")):
            raise ValueError(
                "Invalid URL. Please provide a valid HTTP or HTTPS URL."
            )

        rate_limiter.check(
            key="firecrawl",
            limit=settings.RATE_LIMIT_FIRECRAWL,
        )

        content = scrape_url(url)

        if not content.strip():
            return (
                "Firecrawl successfully accessed the webpage, "
                "but no readable content was returned."
            )

        return content

    except RateLimitExceeded:
        raise

    except ValueError:
        raise

    except Exception as err:
        logger.exception(
            "Firecrawl tool failed | url=%s",
            url,
        )

        raise RuntimeError(
            f"Error scraping the webpage: {str(err)}"
        ) from err