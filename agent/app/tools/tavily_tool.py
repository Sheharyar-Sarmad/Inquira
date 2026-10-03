from langchain.tools import tool
from tavily import TavilyClient

from config import settings
from services.rate_limiter import (
    RateLimitExceeded,
    rate_limiter,
)

if not settings.ENABLE_TAVILY:
    raise RuntimeError(
        "Tavily tool is disabled. Please enable it in the settings to use this feature."
    )

tavily: TavilyClient = TavilyClient(
    api_key=settings.TAVILY_API_KEY
)

@tool
def search_web(query: str) -> str:
    """
    Search the web using Tavily and return relevant search results.
    """
    try:
        if not query or not query.strip():
            raise ValueError(
                "Search query cannot be empty."
            )

        query = query.strip()

        if len(query) > settings.MAX_QUERY_LENGTH:
            raise ValueError(
                f"Search query length exceeds the maximum allowed "
                f"length of {settings.MAX_QUERY_LENGTH} characters."
            )

        rate_limiter.check(
            key="tavily",
            limit=settings.RATE_LIMIT_TAVILY,
        )

        response: dict = tavily.search(
            query=query,
            max_results=settings.TAVILY_MAX_RESULTS,
        )

        results = response.get(
            "results",
            [],
        )

        if not results:
            return "No relevant web results found."

        formatted_results: list[str] = []

        for index, result in enumerate(
            results,
            start=1,
        ):
            title = result.get(
                "title",
                "Untitled",
            )
            url = result.get(
                "url",
                "",
            )
            content = result.get(
                "content",
                "",
            )

            formatted_results.append(
                f"{index}. {title}\n"
                f"URL: {url}\n"
                f"Content: {content}"
            )

        return "\n\n".join(
            formatted_results
        )

    except RateLimitExceeded:
        raise

    except Exception as err:
        raise RuntimeError(
            f"Error searching the web with Tavily: {str(err)}"
        ) from err