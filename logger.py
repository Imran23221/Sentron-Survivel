from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
import uvicorn

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

# Text Colors
WHITE = "\033[97m"
YELLOW = "\033[93m"
BRIGHT_YELLOW = "\033[33;1m"
RED = "\033[91m"
BRIGHT_RED = "\033[31;1m"
CYAN = "\033[96m"
BLUE = "\033[94m"
MAGENTA = "\033[95m"
GREEN = "\033[92m"
GOLD = "\033[38;5;220m"

# Background Colors
BG_RED = "\033[41m"

@app.post("/log")
async def log_event(request: Request):
    data = await request.json()
    time = datetime.now().strftime("%H:%M:%S")
    player = data.get("player", "Unknown")
    action = data.get("action", "").upper()
    
    # 🎨 THE COLOR ENGINE
    style = WHITE # Default
    
    # 💀 ELIMINATED: Bold Bright Yellow
    if "ELIMINATED" in action or "DIED" in action:
        style = BOLD + BRIGHT_YELLOW
        
    # 👹 BOSS: Blink, Gold text on Red Background
    elif "BOSS" in action:
        style = BLINK + GOLD + BG_RED
        
    # ⚡ PULSES
    elif "SUPER PULSE" in action:
        style = MAGENTA
    elif "PULSE" in action:
        style = CYAN # Standard pulse
        
    # ⚙️ MODES
    elif "HARD MODE" in action:
        style = RED
    elif "MEDIUM MODE" in action:
        style = YELLOW
    elif "EASY MODE" in action:
        style = BLUE
        
    # ⏸️ PAUSE / RESUME
    elif "PAUSED" in action:
        style = BOLD + YELLOW
    elif "RESUMED" in action:
        style = BOLD + GREEN
        
    # 🚪 QUIT / TERMINATED: Bold White
    elif "TERMINATED" in action or "QUIT" in action:
        style = BOLD + WHITE
        
    # 🌈 DEFAULT: White or Blue
    else:
        style = BLUE

    # Print the line: [TIME] PLAYER -> ACTION (All colorized)
    print(f"{RESET}[{time}] {GREEN}{player.upper()}{RESET} -> {style}{action}{RESET}")
    return {"status": "success"}

if __name__ == "__main__":
    print(f"{BOLD}{CYAN}--- SENTRON SURVIVAL LIVE DASHBOARD ACTIVE ---{RESET}")
    uvicorn.run(app, host="0.0.0.0", port=8001)

