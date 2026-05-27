import traceback

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.models import ParseRequest, ParseResponse
from app.parser import parse_events

app = FastAPI(
    title="UniFlow Parser API",
    version="0.1.0",
    description="Parse natural language messages into structured calendar events using DeepSeek.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/api/parse", response_model=ParseResponse)
async def parse(request: ParseRequest) -> ParseResponse:
    """Parse a natural language message and return structured event data."""
    if not request.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty.")

    if not settings.DEEPSEEK_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="DEEPSEEK_API_KEY is not configured. Set it in your .env file.",
        )

    try:
        events = await parse_events(request.message)
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
    return ParseResponse(events=events)
