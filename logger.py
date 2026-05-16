import socket
import json
import os
from datetime import datetime

# --- CONFIG ---
PORT = 8001
HOST = '0.0.0.0'
# Color Palette: RED, CYAN, GOLD, GREEN, WHITE, VIOLET, RESET
R, C, Y, G, W, V, X = "\033[1;31m", "\033[1;36m", "\033[1;33m", "\033[1;32m", "\033[1;37m", "\033[1;35m", "\033[0m"

log_history = []
MAX_LOGS = 18 

def draw_dashboard():
    os.system('cls' if os.name == 'nt' else 'clear')
    print(f"{R}="*70)
    print(f"{R}>> [ SENTRON FIREWALL: SECTOR SURVEILLANCE ] <<{X}".center(80))
    print(f"{R}="*70 + f"{X}")
    
    if not log_history:
        print(f"\n{W}   [ STANDBY ] WAITING FOR ENCRYPTED PILOT UPLINK...{X}\n")
    else:
        for entry in log_history:
            time, pilot, action, score = entry['time'], entry['pilot'].upper(), entry['action'], entry['score']
            
            color = W
            if "SHIP" in action: color = V
            elif "MODE" in action: color = C
            elif "PAUSE" in action: color = Y
            elif "PULSE" in action: color = G
            elif "QUIT" in action: color = R
            elif "ELIMINATED" in action: color = R
            
            print(f" {C}[{time}]{X} {W}{pilot}{X} -> {color}{action}{X} | {Y}SCR: {score}{X}")

    print("-" * 70)
    print(f"{R}="*70 + f"{X}")

# --- SERVER CORE ---
server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
server.bind((HOST, PORT))
server.listen(5)

draw_dashboard()

while True:
    try:
        conn, addr = server.accept()
        raw_request = conn.recv(2048).decode('utf-8', errors='ignore')
        
        # Handle the actual data (POST)
        if "POST" in raw_request:
            if "\r\n\r\n" in raw_request:
                body = raw_request.split("\r\n\r\n")[1]
                try:
                    data = json.loads(body)
                    log_history.append({
                        "time": datetime.now().strftime("%H:%M:%S"),
                        "pilot": data.get("player", "UNKNOWN"),
                        "action": data.get("action", "IDLE"),
                        "score": data.get("score", "0")
                    })
                    if len(log_history) > MAX_LOGS: log_history.pop(0)
                    draw_dashboard()
                except:
                    pass
            
            # Send the relaxed response headers back to browser
            response = (
                "HTTP/1.1 200 OK\r\n"
                "Access-Control-Allow-Origin: *\r\n"
                "Access-Control-Allow-Headers: *\r\n"
                "Content-Type: text/plain\r\n\r\n"
                "OK"
            )
            conn.sendall(response.encode())
            
        # FIXES THE ERROR IN YOUR NEW SCREENSHOT: Complete Preflight approval
        elif "OPTIONS" in raw_request:
            response = (
                "HTTP/1.1 200 OK\r\n"
                "Access-Control-Allow-Origin: *\r\n"
                "Access-Control-Allow-Methods: POST, GET, OPTIONS\r\n"
                "Access-Control-Allow-Headers: *\r\n"
                "Connection: keep-alive\r\n\r\n"
            )
            conn.sendall(response.encode())
            
        conn.close()
    except Exception as e:
        pass