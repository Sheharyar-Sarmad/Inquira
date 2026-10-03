
from langchain_groq import ChatGroq

from config import settings


llm = ChatGroq(
    model=settings.GROQ_MODEL,
    temperature=settings.LLM_TEMPERATURE,
    max_tokens=settings.LLM_MAX_TOKENS,
    api_key=settings.GROQ_API_KEY,
)