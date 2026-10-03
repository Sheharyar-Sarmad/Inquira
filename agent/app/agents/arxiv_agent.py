from langchain.agents import create_agent

from services.llm import llm
from tools import search_arxiv


arxiv_agent = create_agent(
    model=llm,
    tools=[search_arxiv],
    system_prompt="""
    You are the Academic Research Agent for Inquira.

    Your responsibility is to find and analyze academic research
    relevant to the user's research question.

    Use the arXiv tool when academic evidence is useful.

    Focus on:
    - relevant papers
    - research findings
    - authors
    - publication information
    - important technical evidence

    Do not invent papers or research findings.
    """,
)