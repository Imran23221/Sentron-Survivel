import socket
import json
import os
from datetime import datetime

PORT = 8001
HOST = '0.0.0.0'

# Color Codes for that "Firewall" look
RED = "\033[1;31m"
CYAN = "\033[1;36m"
GOLD = "\033[1;33m"
GREEN = "\033[1;32m"
RESET = "\033[0m"

def draw_dashboard(pilot, action, score="0"):
    # Clear terminal for that "Live Dashboard" feel
    os.system('cls' if os.name == 'nt' else 'clear')
    
    time_str = datetime.now().strftime("%H:%M:%S")
    
    print(f"{RED}="*60)
    print(f"{RED}>> [ SENTRON FIREWALL DASHBOARD ] <<{RESET}".center(70))
    print(f"{RED}="*60 + f"{RESET}")
    
    print(f"{CYAN} STATUS: ACTIVE          SYSTEM TIME: {time_str}{RESET}")
    print(f"{CYAN} PILOT : {pilot.upper()}{RESET}")
    print("-" * 60)
    
    # Event coloring
    color = RESET
    if "SUPERNOVA" in action: color = GOLD
    elif "ELIMINATED" in action: color = RED
    elif "PULSE" in action: color = GREEN
    
    print(f"\n   LAST SECTOR EVENT:")
    print(f"   {color}>>> {action} <<<{RESET}\n")
    
    print("-" * 60)
    print(f"{GOLD} SESSION HIGH SCORE: {score}{RESET}")
    print(f"{RED}="*60 + f"{RESET}")

# Start Server
server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
server.bind((HOST, PORT))
server.listen(5)

draw_dashboard("Waiting...", "INITIALIZING RADAR")

while True:
    try:
        conn, addr = server.accept()
        raw_request = conn.recv(2048).decode('utf-8', errors='ignore')
        
        if "OPTIONS" in raw_request:
            response = "HTTP/1.1 200 OK\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Methods: POST, OPTIONS\r\nAccess-Control-Allow-Headers: Content-Type\r\n\r\n"
            conn.sendall(response.encode())
        
        elif "POST" in raw_request:
            if "\r\n\r\n" in raw_request:
                body = raw_request.split("\r\n\r\n")[1]
                data = json.loads(body)
                
                # Fetching the extra info you wanted
                pilot = data.get("player", "UNKNOWN")
                action = data.get("action", "IDLE")
                current_score = data.get("score", "0")
                
                draw_dashboard(pilot, action, current_score)
                
                resp = "HTTP/1.1 200 OK\r\nAccess-Control-Allow-Origin: *\r\nContent-Type: application/json\r\n\r\n" + '{"status":"ok"}'
                conn.sendall(resp.encode())
        conn.close()
    except:
        pass