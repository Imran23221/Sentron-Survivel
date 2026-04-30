from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
import uvicorn
import logging
import os

# --- SILENCE THE JUNK ---
# This hides the "INFO: 200 OK" lines so your dashboard stays clean
logging.getLogger("uvicorn.access").setLevel(logging.WARNING)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# COLOR & STYLE DEFINITIONS
RESET = "\033[0m"
BOLD = "\033[1m"
BLINK = "\033[5m"
GREEN = "\033[92m"
CYAN = "\033[96m"
YELLOW = "\033[93m"
BRIGHT_YELLOW = "\033[33;1m"
RED = "\033[91m"
MAGENTA = "\033[95m"
BLUE = "\033[94m"
WHITE = "\033[97m"
GOLD = "\033[38;5;220m"
BG_RED = "\033[41m"

def print_border():
    print(f"{CYAN}=" * 60 + f"{RESET}")

@app.post("/log")
async def log_event(request: Request):
    data = await request.json()
    time = datetime.now().strftime("%H:%M:%S")
    player = data.get("player", "UNKNOWN").upper()
    action = data.get("action", "").upper()
    
    # 🎨 THE COLOR ENGINE
    style = WHITE
    
    if "ELIMINATED" in action or "DIED" in action:
        style = BOLD + BRIGHT_YELLOW
    elif "BOSS" in action:
        style = BLINK + GOLD + BG_RED
    elif "SUPER" in action:
        style = MAGENTA
    elif "STANDARD" in action:
        style = BLUE
    elif "HARD" in action:
        style = RED
    elif "PAUSED" in action:
        style = BOLD + YELLOW
    elif "RESUMED" in action:
        style = BOLD + GREEN
    elif "TERMINATED" in action:
        style = BOLD + WHITE
    else:
        style = CYAN

    # --- THE VISUAL DASHBOARD LINE ---
    # This creates the "Dashboard" look with a border on the side
    print(f"{CYAN}║ {RESET}[{time}] {GREEN}{player:<12}{RESET} ➔ {style}{action}{RESET}")
    return {"status": "success"}

if __name__ == "__main__":
    # Clear terminal on start
    os.system('clear' if os.name == 'posix' else 'cls')
    
    print(f"{CYAN}╔" + "═" * 58 + "╗")
    print(f"║{BOLD}{GOLD} SENTRON SURVIVAL: LIVE COMMAND CENTER {RESET}{CYAN}║")
    print(f"╚" + "═" * 58 + "╝{RESET}")
    
    uvicorn.run(app, host="0.0.0.0", port=8001, log_level="warning")

