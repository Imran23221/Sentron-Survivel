from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
import uvicorn
import logging
import os

logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
app = FastAPI()

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# Colors
CYAN, GREEN, YELLOW, RED, RESET = "\033[96m", "\033[92m", "\033[93m", "\033[91m", "\033[0m"
MAGENTA, GOLD, BG_RED, BOLD = "\033[95m", "\033[38;5;220m", "\033[41m", "\033[1m"

@app.post("/log")
async def log_event(request: Request):
    data = await request.json()
    time = datetime.now().strftime("%H:%M:%S")
    player = data.get("player", "UNKNOWN").upper()
    action = data.get("action", "").upper()
    
    # Logic for colors
    style = RED if "ELIMINATED" in action else (MAGENTA if "SUPER" in action else CYAN)
    if "BOSS" in action: style = GOLD + BG_RED

    # THE BORDERED INFO BOX
    print(f"{CYAN}┌──────────────────────┬──────────────────┬────────────────────────────┐{RESET}")
    print(f"{CYAN}│ {YELLOW}{time} {CYAN}│ {GREEN}{player:^16} {CYAN}│ {style}{action:^26} {CYAN}│{RESET}")
    print(f"{CYAN}└──────────────────────┴──────────────────┴────────────────────────────┘{RESET}")
    return {"status": "success"}

if __name__ == "__main__":
    os.system('clear' if os.name == 'posix' else 'cls')
    print(f"{GOLD}{BOLD}=== SENTRON SURVIVAL: LIVE COMMAND CENTER ==={RESET}")
    uvicorn.run(app, host="0.0.0.0", port=8001, log_level="warning")

