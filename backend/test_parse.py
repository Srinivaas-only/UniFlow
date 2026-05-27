"""Quick smoke test for the /api/parse endpoint."""
import urllib.request
import json

payload = json.dumps({"message": "calc quiz thursday 2pm, OS assignment due friday"}).encode()

req = urllib.request.Request(
    "http://127.0.0.1:8000/api/parse",
    data=payload,
    headers={"Content-Type": "application/json"},
    method="POST",
)

try:
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read())
        print(json.dumps(data, indent=2))
except urllib.error.HTTPError as e:
    print(f"HTTP {e.code}")
    body = e.read().decode()
    print(body)
except Exception as e:
    print(f"Error: {e}")