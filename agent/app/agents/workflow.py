import json
import logging
import time
from concurrent.futures import ThreadPoolExecutor

from langchain_core.messages import HumanMessage, SystemMessage, ToolMessage

from services.llm import llm
from tools import (
    get_firecrawl_tool,
    search_arxiv,
    search_web,
    search_wikipedia,
)


logger = logging.getLogger(__name__)

MAX_TOOL_OUTPUT_CHARS: int = 3000
MAX_TOOL_ROUNDS: int = 3  # hard cap on research rounds, whatever .env says

TOOLS = [search_web, search_wikipedia, search_arxiv, get_firecrawl_tool]
TOOLS_BY_NAME = {t.name: t for t in TOOLS}

RESEARCH_PROMPT = """
You are the research agent for Inquira.

Tools: search_web (current info), search_wikipedia (background),
search_arxiv (papers), get_firecrawl_tool (read one webpage).

Rules:
1. Call the tools you need IN ONE STEP (several at once), not one by one.
2. Never repeat a call with the same input.
3. If a tool fails, continue with the others.
4. After at most 2 tool rounds, write a concise research summary.
5. Do not invent information.
""".strip()

WRITER_PROMPT = """
You are the Writer Agent for Inquira.
Turn the collected research into a clear, structured report.
Use only the information provided. Do not invent facts or sources.
Structure: Introduction, Key findings, Detailed analysis, Sources, Conclusion.
""".strip()


def _text(content) -> str:
    return content if isinstance(content, str) else json.dumps(content, ensure_ascii=False)


def _run_tool(name: str, args: dict) -> str:
    tool = TOOLS_BY_NAME.get(name)
    if tool is None:
        return f"Unknown tool: {name}"

    start = time.time()
    try:
        output = _text(tool.invoke(args))
    except Exception as err:
        output = f"Tool '{name}' failed: {err}. Continue with other sources."

    logger.info("tool %s took %.1fs", name, time.time() - start)
    return output[:MAX_TOOL_OUTPUT_CHARS]


def run_research(query: str, max_iterations: int) -> dict:
    model = llm.bind_tools(TOOLS)

    messages = [
        SystemMessage(content=RESEARCH_PROMPT),
        HumanMessage(content=query),
    ]

    tools_used: list[dict] = []
    seen: set[str] = set()
    research = ""
    rounds = min(max_iterations, MAX_TOOL_ROUNDS)

    for round_no in range(rounds):
        start = time.time()
        response = model.invoke(messages)
        logger.info("research model call %d took %.1fs", round_no + 1, time.time() - start)
        messages.append(response)

        if not response.tool_calls:
            research = _text(response.content)
            break

        pending = []
        for call in response.tool_calls:
            sig = f"{call['name']}:{json.dumps(call.get('args', {}), sort_keys=True)}"
            if sig in seen:
                messages.append(
                    ToolMessage(
                        content="Already called. Use existing results.",
                        tool_call_id=call["id"],
                        name=call["name"],
                    )
                )
                continue
            seen.add(sig)
            tools_used.append({"name": call["name"], "input": call.get("args", {})})
            pending.append(call)

        # Run this round's tools in parallel
        with ThreadPoolExecutor(max_workers=4) as pool:
            results = list(
                pool.map(lambda c: _run_tool(c["name"], c.get("args", {})), pending)
            )

        for call, result in zip(pending, results):
            messages.append(
                ToolMessage(content=result, tool_call_id=call["id"], name=call["name"])
            )

    if not research:
        messages.append(
            HumanMessage(content="Stop using tools. Write your concise research summary now.")
        )
        start = time.time()
        research = _text(llm.invoke(messages).content)
        logger.info("forced summary took %.1fs", time.time() - start)

    start = time.time()
    writer_response = llm.invoke(
        [
            SystemMessage(content=WRITER_PROMPT),
            HumanMessage(
                content=(
                    f"Research question:\n\n{query}\n\n"
                    f"Collected research:\n\n{research}\n\n"
                    "Write the final research report."
                )
            ),
        ]
    )
    logger.info("writer call took %.1fs", time.time() - start)

    return {"answer": _text(writer_response.content), "tools_used": tools_used}