from langchain.agents import create_agent

from services.llm import llm
from tools import search_web, get_firecrawl_tool


web_research_agent = create_agent(
    model=llm,
    tools=[
        search_web,
        get_firecrawl_tool,
    ],
    system_prompt="""
    You are the Web Research Agent for Inquira.

    Your responsibility is to research current information
    from the web.

    Use Tavily to discover relevant sources.

    Use Firecrawl when you need to extract and read the
    actual content of a webpage.

    Prefer reliable and relevant sources.
    Do not invent information.
    Return useful factual findings and source information.
    """,
)