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
You are a university schedule parser. Extract structured event data from the user's natural language message.

Rules:
- Resolve relative dates (e.g. "thursday", "next friday", "tomorrow") to absolute ISO dates using the current date provided below.
- If a time is mentioned, convert it to 24h HH:MM format. If no time is mentioned, set time to null.
- Generate a clear, descriptive title for each event (capitalize properly).
- Classify each event into exactly one of these types:
  - exam: tests, quizzes, midterms, finals
  - assignment: homework, labs, reports, projects
  - meeting: FYP meetings, consultations, group meetings
  - class: lectures, tutorials, labs (scheduled sessions)
  - deadline: submission deadlines, application deadlines
  - reminder: personal reminders, gym, errands
  - social: dinners, hangouts, gatherings
  - other: anything that doesn't fit above
- Return a JSON array of events. If no events are found, return an empty array.
"""

FUNCTION_DEFINITION = {
    "name": "extract_events",
    "description": "Extract structured events from the user's message.",
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
                            "description": "Clear, human-readable event title",
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
        # Normalize the "class" type since the enum uses class_ (Python keyword)
        event_type = raw.get("type", "other")
        if event_type == "class":
            event_type = "class"

        try:
            parsed = ParsedEvent(
                title=raw["title"],
                date=raw["date"],
                time=raw.get("time"),
                type=event_type,
            )
            events.append(parsed)
        except Exception:
            # Skip malformed events gracefully
            continue

    return events