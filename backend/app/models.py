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
    expense = "expense"
    other = "other"


class ParsedEvent(BaseModel):
    title: str = Field(..., description="A clear, human-readable event title")
    date: str = Field(..., description="ISO date string YYYY-MM-DD")
    time: Optional[str] = Field(
        None, description="24h time string HH:MM, or null if not specified"
    )
    type: EventType = Field(..., description="Event type category")
    amount: Optional[str] = Field(
        None, description="Expense amount (e.g. 'RM15'), null for non-expense events"
    )
    category: Optional[str] = Field(
        None, description="Expense category (food/transport/education/rent/other), null for non-expense"
    )


class ParseRequest(BaseModel):
    message: str = Field(
        ..., description="Natural language message containing one or more events"
    )


class ParseResponse(BaseModel):
    events: list[ParsedEvent] = Field(
        default_factory=list, description="List of parsed events"
    )


# --- Scholarship models ---

class ScholarshipProfile(BaseModel):
    cgpa: float = Field(..., description="Current CGPA")
    course: str = Field(..., description="Course/program name")
    year: int = Field(..., description="Year of study")
    state: str = Field(..., description="State in Malaysia")


class ScholarshipResult(BaseModel):
    title: str
    provider: str = ""
    amount: str = ""
    deadline: str = ""
    eligibility: str = ""
    link: str = ""
    match_score: int = 0


class ScholarshipResponse(BaseModel):
    scholarships: list[ScholarshipResult] = Field(default_factory=list)


# --- Resource models ---

class ResourceRequest(BaseModel):
    subject: str = Field(..., description="Subject name to search for")


class ResourceResult(BaseModel):
    title: str
    type: str = ""  # past_paper, textbook, notes, video, other
    source: str = ""
    link: str = ""
    description: str = ""


class ResourceResponse(BaseModel):
    resources: list[ResourceResult] = Field(default_factory=list)


# --- Uni Calendar models ---

class UniCalendarRequest(BaseModel):
    university: str = Field("UM", description="University code: UM, USM, UKM, UTM")


class CalendarEvent(BaseModel):
    title: str
    date: str = ""
    end_date: str = ""
    category: str = ""  # semester, exam, holiday, registration, other
    description: str = ""


class UniCalendarResponse(BaseModel):
    university: str
    events: list[CalendarEvent] = Field(default_factory=list)


# --- Internship models ---

class InternshipProfile(BaseModel):
    cgpa: float = Field(..., description="Current CGPA")
    course: str = Field(..., description="Course/program name")
    year: int = Field(..., description="Year of study")
    semester: int = Field(default=2, description="Semester")
    state: str = Field(default="Selangor", description="State in Malaysia")


class InternshipResult(BaseModel):
    company: str = ""
    role: str = ""
    duration: str = ""
    location: str = ""
    allowance: str = ""
    eligibility: str = ""
    deadline: str = ""
    link: str = ""
    snippet: str = ""
    match_score: int = 0


class InternshipResponse(BaseModel):
    internships: list[InternshipResult] = Field(default_factory=list)