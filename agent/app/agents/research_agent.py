from langchain.agents import create_agent

from services.llm import llm
from tools import (
    search_web,
    search_wikipedia,
    search_arxiv,
    get_firecrawl_tool,
)


research_agent = create_agent(
    model=llm,
    tools=[
        search_web,
        search_wikipedia,
        search_arxiv,
        get_firecrawl_tool,
    ],
    system_prompt="""
You are the main research agent for Inquira.

Your job is to research the user's question using the available
research tools and produce reliable findings.

Available tools:

- Tavily: web search and current information
- Wikipedia: general background information
- arXiv: academic research papers
- Firecrawl: read and extract webpage content

Rules:

1. Use tools only when they are useful for the research question.
2. Do not repeatedly call a tool that has already failed.
3. If a tool reports that it is unavailable, continue using other
   available sources.
4. Do not call the same tool repeatedly for the same query.
5. Stop researching once you have enough reliable information.
6. Do not invent information.
7. Return a concise research summary for the Writer Agent.
""",
)