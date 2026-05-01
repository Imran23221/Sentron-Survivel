import socket
import json
import os
from datetime import datetime

PORT = 8001
HOST = '0.0.0.0'

# Color Palette
RED, CYAN, GOLD, GREEN, WHITE, VIOLET, RESET = "\033[1;31m", "\033[1;36m", "\033[1;33m", "\033[1;32m", "\033[1;37m", "\033[1;35m", "\033[0m"

log_history = []
MAX_LOGS = 15 

def draw_dashboard():
    os.system('cls' if os.name == 'nt' else 'clear')
    print(f"{RED}="*65)
    print(f"{RED}>> [ SENTRON FIREWALL: DEEP SCAN ACTIVE ] <<{RESET}".center(75))
    print(f"{RED}="*65 + f"{RESET}")
    
    if not log_history:
        print(f"\n{WHITE}   [ SEARCHING ] NO PILOT SIGNATURE DETECTED...{RESET}\n")
    else:
        for entry in log_history:
            time, pilot, action, score = entry['time'], entry['pilot'].upper(), entry['action'], entry['score']
            
            # Smart Color Logic
            color = WHITE
            if "SHIP" in action: color = VIOLET
            elif "MODE" in action: color = CYAN
            elif "PAUSE" in action or "RESUME" in action: color = GOLD
            elif "ELIMINATED" in action: color = RED
            elif "PULSE" in action: color = GREEN
            
            print(f" {CYAN}[{time}]{RESET} {WHITE}{pilot}{RESET} -> {color}{action}{RESET} | {GOLD}SCR: {score}{RESET}")

    print("-" * 65)
    print(f"{RED}="*65 + f"{RESET}")

server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
server.bind((HOST, PORT))
server.listen(5)
draw_dashboard()

while True:
    try:
        conn, addr = server.accept()
        raw_request = conn.recv(2048).decode('utf-8', errors='ignore')
        if "POST" in raw_request and "\r\n\r\n" in raw_request:
            body = raw_request.split("\r\n\r\n")[1]
            data = json.loads(body)
            new_entry = {
                "time": datetime.now().strftime("%H:%M:%S"),
                "pilot": data.get("player", "UNKNOWN"),
                "action": data.get("action", "IDLE"),
                "score": data.get("score", "0")
            }
            log_history.append(new_entry)
            if len(log_history) > MAX_LOGS: log_history.pop(0)
            draw_dashboard()
            conn.sendall(b"HTTP/1.1 200 OK\r\nAccess-Control-Allow-Origin: *\r\n\r\n")
        elif "OPTIONS" in raw_request:
            conn.sendall(b"HTTP/1.1 200 OK\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Methods: POST, OPTIONS\r\nAccess-Control-Allow-Headers: Content-Type\r\n\r\n")
        conn.close()
    except: pass