import json
from datetime import datetime, timezone

from openai import OpenAI

from app.config import settings
from app.models import EventType, ParsedEvent

_client: OpenAI | None = None


def _get_client() -> OpenAI:
    global _client
    if _client is None:
        _client = OpenAI(
            api_key=settings.DEEPSEEK_API_KEY,
            base_url=settings.DEEPSEEK_BASE_URL,
        )
    return _client

SYSTEM_PROMPT = """\
You are a university student life parser. Extract structured event and expense data from the user's natural language message.

Rules:
- Resolve relative dates (e.g. "thursday", "next friday", "tomorrow") to absolute ISO dates using the current date provided below.
- If a time is mentioned, convert it to 24h HH:MM format. If no time is mentioned, set time to null.
- Generate a clear, descriptive title for each event (capitalize properly).
- Classify each item into exactly one of these types:
  - exam: tests, quizzes, midterms, finals
  - assignment: homework, labs, reports, projects
  - meeting: FYP meetings, consultations, group meetings
  - class: lectures, tutorials, labs (scheduled sessions)
  - deadline: submission deadlines, application deadlines
  - reminder: personal reminders, gym, errands
  - social: dinners, hangouts, gatherings
  - expense: any spending/purchase mentioned (food, transport, textbooks, rent, etc.)
  - other: anything that doesn't fit above

For expense items:
- Set amount to the monetary value with currency (e.g. "RM15", "$20")
- Set category to one of: food, transport, education, rent, entertainment, other
- The date should be today's date unless a specific date is mentioned
- Time can be null for expenses

Return a JSON array of items. If no items are found, return an empty array.
"""

FUNCTION_DEFINITION = {
    "name": "extract_events",
    "description": "Extract structured events and expenses from the user's message.",
    "parameters": {
        "type": "object",
        "properties": {
            "events": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "title": {
                            "type": "string",
                            "description": "Clear, human-readable title",
                        },
                        "date": {
                            "type": "string",
                            "description": "ISO date YYYY-MM-DD",
                        },
                        "time": {
                            "type": ["string", "null"],
                            "description": "24h time HH:MM or null",
                        },
                        "type": {
                            "type": "string",
                            "enum": [e.value for e in EventType],
                        },
                        "amount": {
                            "type": ["string", "null"],
                            "description": "Monetary amount with currency for expenses, null otherwise",
                        },
                        "category": {
                            "type": ["string", "null"],
                            "description": "Expense category (food/transport/education/rent/entertainment/other), null for non-expenses",
                        },
                    },
                    "required": ["title", "date", "time", "type"],
                },
            }
        },
        "required": ["events"],
    },
}


async def parse_events(message: str) -> list[ParsedEvent]:
    """Parse a natural language message into structured events using DeepSeek."""
    now = datetime.now(timezone.utc)
    today_str = now.strftime("%A, %Y-%m-%d")

    user_content = (
        f"Current date: {today_str}\n\n"
        f"Message: \"{message}\""
    )

    response = _get_client().chat.completions.create(
        model=settings.DEEPSEEK_MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_content},
        ],
        tools=[
            {
                "type": "function",
                "function": FUNCTION_DEFINITION,
            }
        ],
        tool_choice={"type": "function", "function": {"name": "extract_events"}},
        temperature=0.1,
    )

    tool_calls = response.choices[0].message.tool_calls
    if not tool_calls:
        return []

    arguments_str = tool_calls[0].function.arguments
    arguments = json.loads(arguments_str)

    raw_events = arguments.get("events", [])
    events: list[ParsedEvent] = []

    for raw in raw_events:
        event_type = raw.get("type", "other")
        if event_type == "class":
            event_type = "class"

        try:
            parsed = ParsedEvent(
                title=raw["title"],
                date=raw["date"],
                time=raw.get("time"),
                type=event_type,
                amount=raw.get("amount"),
                category=raw.get("category"),
            )
            events.append(parsed)
        except Exception:
            continue

    return events