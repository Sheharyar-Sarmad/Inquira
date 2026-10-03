from langchain.tools import tool
import arxiv

from config import settings
from services.rate_limiter import rate_limiter

if not settings.ENABLE_ARXIV:
    raise RuntimeError(
        "arXiv tool is disabled. Please enable it in the settings to use this feature."
    )

@tool
def search_arxiv(query: str) -> str:
    """
    Search arXiv for relevant academic research papers and return their details.
    """
    try:
        if not query or not query.strip():
            raise ValueError(
                "arXiv search query cannot be empty."
            )

        query = query.strip()

        if len(query) > settings.MAX_QUERY_LENGTH:
            raise ValueError(
                f"arXiv search query length exceeds the maximum allowed "
                f"length of {settings.MAX_QUERY_LENGTH} characters."
            )

        rate_limiter.check(
            key="arxiv",
            limit=settings.RATE_LIMIT_ARXIV,
        )

        search = arxiv.Search(
            query=query,
            max_results=settings.ARXIV_MAX_RESULTS,
            sort_by=arxiv.SortCriterion.Relevance,
        )

        client = arxiv.Client()

        results = list(
            client.results(search)
        )

        if not results:
            return "No relevant arXiv papers found."

        formatted_results: list[str] = []

        for index, result in enumerate(
            results,
            start=1,
        ):
            authors = ", ".join(
                author.name
                for author in result.authors
            )

            formatted_results.append(
                f"{index}. {result.title}\n"
                f"Authors: {authors}\n"
                f"Published: "
                f"{result.published.strftime('%Y-%m-%d')}\n"
                f"URL: {result.entry_id}\n"
                f"Abstract: {result.summary}"
            )

        return "\n\n".join(
            formatted_results
        )

    except Exception as err:
        raise RuntimeError(
            f"Error searching arXiv: {str(err)}"
        ) from err