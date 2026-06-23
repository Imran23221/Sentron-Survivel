import socket
import os
from datetime import datetime
from urllib.parse import parse_qs

PORT = 8001
HOST = '0.0.0.0'

# Color Engine
RED    = "\033[1;31m"
CYAN   = "\033[1;36m"
GOLD   = "\033[1;33m"
GREEN  = "\033[1;32m"
WHITE  = "\033[1;37m"
VIOLET = "\033[1;35m"
ORANGE = "\033[38;5;214m"
RESET  = "\033[0m"

log_history = []
MAX_LOGS = 15

def render_firewall_dash():
    os.system('cls' if os.name == 'nt' else 'clear')
    print(f"{RED}=" * 65)
    print(f"{RED}>> [ SENTRON FIREWALL v2.5: LIVE MONITOR ] <<{RESET}".center(75))
    print(f"{RED}=" * 65 + f"{RESET}")
    print(f"{CYAN} SYSTEM GATEWAY: ACTIVE          TARGET PORT: {PORT}{RESET}")
    print("-" * 65)

    if not log_history:
        print(f"\n{WHITE}   [ SYSTEM IDLE ] AWAITING INCOMING COMBAT SIGNALS...{RESET}\n")
    else:
        for entry in log_history:
            timestamp = entry.get('time', '')
            pilot     = entry.get('pilot', 'UNKNOWN').upper()
            action    = entry.get('action', 'IDLE')
            score     = entry.get('score', '0')
            wave      = entry.get('wave', '')

            color = WHITE
            if   "SHIP" in action or "CRAFT" in action:   color = VIOLET
            elif "MODE" in action:                         color = CYAN
            elif "PAUSE" in action or "RESUME" in action: color = GOLD
            elif "ELIMINATED" in action or "QUIT" in action: color = RED
            elif "PULSE" in action or "CHEAT" in action:  color = GREEN
            elif "SURVIVAL START" in action:               color = ORANGE
            elif "SURVIVAL END" in action:                 color = RED
            elif "SURVIVAL BOSS" in action:                color = VIOLET
            elif "POWER-UP" in action:                     color = ORANGE
            elif "INVENTORY" in action:                    color = GOLD
            elif "SURVIVAL" in action:                     color = ORANGE

            wave_tag = f" | {CYAN}WAVE: {wave}{RESET}" if wave else ""
            print(f" {CYAN}[{timestamp}]{RESET} {WHITE}{pilot}{RESET} -> {color}{action}{RESET} | {GOLD}SCORE: {score}{RESET}{wave_tag}")

    print("-" * 65)
    print(f"{RED}=" * 65 + f"{RESET}")


server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
server.bind((HOST, PORT))
server.listen(5)

render_firewall_dash()

while True:
    try:
        conn, addr = server.accept()
        raw_request = conn.recv(4096).decode('utf-8', errors='ignore')

        if "POST" in raw_request:
            _, _, body = raw_request.partition("\r\n\r\n")
            if body:
                try:
                    parsed_data = parse_qs(body.strip())

                    pilot_name = parsed_data.get("player", ["Pilot"])[0]
                    action_msg = parsed_data.get("action", ["SYSTEM_CHECK"])[0]
                    live_score = parsed_data.get("score",  ["0"])[0]
                    wave_num   = parsed_data.get("wave",   [""])[0]

                    log_history.append({
                        "time":  datetime.now().strftime("%H:%M:%S"),
                        "pilot": pilot_name,
                        "action": action_msg,
                        "score": live_score,
                        "wave":  wave_num,
                    })

                    if len(log_history) > MAX_LOGS:
                        log_history.pop(0)

                    render_firewall_dash()
                except Exception:
                    pass

            response = (
                "HTTP/1.1 200 OK\r\n"
                "Access-Control-Allow-Origin: *\r\n"
                "Access-Control-Allow-Headers: *\r\n"
                "Content-Type: text/plain\r\n"
                "Connection: close\r\n\r\n"
                "ACK"
            )
            conn.sendall(response.encode())

        elif "OPTIONS" in raw_request:
            response = (
                "HTTP/1.1 200 OK\r\n"
                "Access-Control-Allow-Origin: *\r\n"
                "Access-Control-Allow-Methods: POST, GET, OPTIONS\r\n"
                "Access-Control-Allow-Headers: *\r\n"
                "Connection: close\r\n\r\n"
            )
            conn.sendall(response.encode())

        conn.close()
    except Exception:
        pass