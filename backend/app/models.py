from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class EventType(str, Enum):
    exam = "exam"
    assignment = "assignment"
    meeting = "meeting"
    class_ = "class"
    deadline = "deadline"
    reminder = "reminder"
    social = "social"
    other = "other"


class ParsedEvent(BaseModel):
    title: str = Field(..., description="A clear, human-readable event title")
    date: str = Field(..., description="ISO date string YYYY-MM-DD")
    time: Optional[str] = Field(
        None, description="24h time string HH:MM, or null if not specified"
    )
    type: EventType = Field(..., description="Event type category")


class ParseRequest(BaseModel):
    message: str = Field(
        ..., description="Natural language message containing one or more events"
    )


class ParseResponse(BaseModel):
    events: list[ParsedEvent] = Field(
        default_factory=list, description="List of parsed events"
    )