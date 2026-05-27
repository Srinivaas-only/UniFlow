# UniFlow Parser API

FastAPI backend that parses natural language messages into structured calendar events using **DeepSeek**.

## Quick Start

```bash
cd backend

# 1. Create a virtual environment
python -m venv venv
venv\Scripts\activate    # Windows
# source venv/bin/activate  # macOS/Linux

# 2. Install dependencies
pip install -r requirements.txt

# 3. Set up your DeepSeek API key
cp .env.example .env
# Edit .env and add your DeepSeek API key

# 4. Run the server
uvicorn app.main:app --reload --port 8000
```

## API Usage

### `POST /api/parse`

**Request:**

```json
{
  "message": "calc quiz thursday 2pm, OS assignment due friday"
}
```

**Response:**

```json
{
  "events": [
    {
      "title": "Calculus Quiz",
      "date": "2026-05-28",
      "time": "14:00",
      "type": "exam"
    },
    {
      "title": "OS Assignment Due",
      "date": "2026-05-29",
      "time": null,
      "type": "assignment"
    }
  ]
}
```

### Event Types

| Type        | Examples                                    |
|-------------|---------------------------------------------|
| `exam`      | tests, quizzes, midterms, finals            |
| `assignment`| homework, labs, reports, projects           |
| `meeting`   | FYP meetings, consultations, group meetings |
| `class`     | lectures, tutorials, labs                   |
| `deadline`  | submission deadlines, application deadlines |
| `reminder`  | personal reminders, gym, errands            |
| `social`    | dinners, hangouts, gatherings               |
| `other`     | anything else                               |

### CORS

CORS is enabled for all origins (`*`) so your Next.js frontend can connect without issues. Restrict `allow_origins` in production.

### Interactive Docs

Once running, visit [http://localhost:8000/docs](http://localhost:8000/docs) for Swagger UI.

## Environment Variables

| Variable          | Default                        | Description            |
|-------------------|--------------------------------|------------------------|
| `DEEPSEEK_API_KEY`| *(required)*                   | Your DeepSeek API key  |
| `DEEPSEEK_BASE_URL`| `https://api.deepseek.com`    | DeepSeek API endpoint  |
| `DEEPSEEK_MODEL`  | `deepseek-chat`               | DeepSeek model to use  |