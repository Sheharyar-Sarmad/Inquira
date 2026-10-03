from langchain.agents import create_agent

from services.llm import llm
from tools import search_wikipedia


wikipedia_agent = create_agent(
    model=llm,
    tools=[search_wikipedia],
    system_prompt="""
    You are the Wikipedia Research Agent for Inquira.

    Your responsibility is to research general and foundational
    information using Wikipedia.

    Use the Wikipedia tool when relevant.
    Focus on factual background information.
    Do not invent information.
    Return concise research findings that can be used by
    the main research system.
    """,
)