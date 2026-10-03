import logging

import wikipedia
from langchain.tools import tool
from requests.exceptions import RequestException

from config import settings
from services.rate_limiter import (
    RateLimitExceeded,
    rate_limiter,
)


logger = logging.getLogger(__name__)


if not settings.ENABLE_WIKIPEDIA:
    raise RuntimeError(
        "Wikipedia tool is disabled. Please enable it in the settings to use this feature."
    )


wikipedia.set_user_agent("Inquira/1.0 (developersheharyar2010@gmail.com)")
wikipedia.set_rate_limiting(True)


@tool
def search_wikipedia(query: str) -> str:
    """
    Search Wikipedia and return relevant article summaries.
    """

    try:
        if not query or not query.strip():
            raise ValueError(
                "Wikipedia search query cannot be empty."
            )

        query = query.strip()

        if len(query) > settings.MAX_QUERY_LENGTH:
            raise ValueError(
                f"Wikipedia search query length exceeds the maximum allowed "
                f"length of {settings.MAX_QUERY_LENGTH} characters."
            )

        rate_limiter.check(
            key="wikipedia",
            limit=settings.RATE_LIMIT_WIKIPEDIA,
        )

        try:
            search_results: list[str] = wikipedia.search(
                query,
                results=settings.WIKIPEDIA_MAX_RESULTS,
            )

        except (RequestException, ValueError) as err:
            logger.warning(
                "Wikipedia search failed: %s",
                err,
            )

            return (
                "Wikipedia is temporarily unavailable. "
                "Continue the research using the other available sources."
            )

        if not search_results:
            return "No relevant Wikipedia articles found."

        formatted_results: list[str] = []

        for index, title in enumerate(
            search_results,
            start=1,
        ):
            try:
                summary: str = wikipedia.summary(
                    title,
                    sentences=5,
                    auto_suggest=False,
                )

                formatted_results.append(
                    f"{index}. {title}\n"
                    f"Summary: {summary}"
                )

            except wikipedia.exceptions.DisambiguationError as err:
                options = ", ".join(
                    err.options[:5]
                )

                formatted_results.append(
                    f"{index}. {title}\n"
                    f"Disambiguation: Multiple articles found. "
                    f"Possible options: {options}"
                )

            except wikipedia.exceptions.PageError:
                continue

            except (RequestException, ValueError) as err:
                logger.warning(
                    "Wikipedia article request failed | title=%s | error=%s",
                    title,
                    err,
                )

                continue

            except Exception as err:
                logger.warning(
                    "Wikipedia article processing failed | title=%s | error=%s",
                    title,
                    err,
                )

                continue

        if not formatted_results:
            return (
                "Wikipedia did not return readable articles. "
                "Continue the research using the other available sources."
            )

        return "\n\n".join(
            formatted_results
        )

    except RateLimitExceeded:
        raise

    except ValueError:
        raise

    except Exception as err:
        logger.exception(
            "Unexpected Wikipedia tool error."
        )

        return (
            "Wikipedia is temporarily unavailable. "
            "Continue the research using the other available sources."
        )