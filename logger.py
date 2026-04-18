import asyncio
from fastapi import FastAPI, Request
from rich.console import Console
from rich.panel import Panel
from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# This allows your game to talk to this python script
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

console = Console()

@app.post("/log")
async def log_event(request: Request):
    try:
        data = await request.json()
    except:
        return {"status": "error"}

    time = datetime.now().strftime("%H:%M:%S")
    action = data.get("action", "Unknown Action")

    # 1. COLOR LOGIC
    # Priority is given to Player Eliminated and Boss events
    if "ELIMINATED" in action:
        color = "bold yellow" # The "Golden" text
        border_style = "bright_yellow" # The "Golden" border
    elif "BOSS" in action:
        color = "blink bold white on red"
        border_style = "bright_red"
    elif "Super Pulse" in action:
        color = "bright_magenta"
        border_style = "magenta"
    elif "Standard Pulse" in action:
        color = "cyan"
        border_style = "blue"
    elif "HARD" in action:
        color = "red"
        border_style = "red"
    elif "MEDIUM" in action:
        color = "yellow"
        border_style = "yellow"
    elif "EASY" in action:
        color = "blue"
        border_style = "blue"
    elif "PAUSED" in action:
        color = "bold yellow"
        border_style = "yellow"
    elif "RESUMED" in action:
        color = "bold green"
        border_style = "green"
    elif "TERMINATED" in action or "Quit" in action:
        color = "bold white"
        border_style = "white"
    else:
        color = "white"
        border_style = "blue"

    # 2. THE DASHBOARD OUTPUT
    console.print(Panel(
        f"[bold cyan]{time}[/bold cyan] | [bold green]EVENT:[/bold green] [bold {color}]{action}[/bold {color}]", 
        title="[bold red]SENTRON SURVIVAL DASHBOARD[/bold red]", 
        border_style=border_style
    ))

    return {"status": "logged"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)

