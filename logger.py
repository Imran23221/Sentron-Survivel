import socket
import json
import os
from datetime import datetime

PORT = 8001
HOST = '0.0.0.0'

# Color Palette
RED = "\033[1;31m"
CYAN = "\033[1;36m"
GOLD = "\033[1;33m"
GREEN = "\033[1;32m"
WHITE = "\033[1;37m"
RESET = "\033[0m"

# This list will store our history
log_history = []
MAX_LOGS = 12 

def draw_dashboard():
    # Clear screen to redraw the updated list
    os.system('cls' if os.name == 'nt' else 'clear')
    
    print(f"{RED}="*65)
    print(f"{RED}>> [ SENTRON FIREWALL: LIVE SECTOR FEED ] <<{RESET}".center(75))
    print(f"{RED}="*65 + f"{RESET}")
    print(f"{CYAN} STATUS: MONITORING...          PORT: {PORT}{RESET}")
    print("-" * 65)

    # If no logs yet
    if not log_history:
        print(f"\n{WHITE}   [ STANDBY ] WAITING FOR PILOT SIGNAL...{RESET}\n")
    else:
        # Print the history of logs
        for entry in log_history:
            time = entry['time']
            pilot = entry['pilot'].upper()
            action = entry['action']
            score = entry['score']
            
            # Pick color based on action
            color = WHITE
            if "SUPER" in action: color = GOLD
            elif "PULSE" in action: color = GREEN
            elif "ELIMINATED" in action: color = RED
            
            print(f" {CYAN}[{time}]{RESET} {WHITE}{pilot}{RESET} -> {color}{action}{RESET} | {GOLD}SCR: {score}{RESET}")

    print("-" * 65)
    print(f"{RED}="*65 + f"{RESET}")

# Start the Network Socket
server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
server.bind((HOST, PORT))
server.listen(5)

draw_dashboard()

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
                
                # Create a new log entry
                new_entry = {
                    "time": datetime.now().strftime("%H:%M:%S"),
                    "pilot": data.get("player", "UNKNOWN"),
                    "action": data.get("action", "IDLE"),
                    "score": data.get("score", "0")
                }
                
                # Add to history and keep it within the MAX_LOGS limit
                log_history.append(new_entry)
                if len(log_history) > MAX_LOGS:
                    log_history.pop(0) # Remove oldest
                
                draw_dashboard()
                
                resp = "HTTP/1.1 200 OK\r\nAccess-Control-Allow-Origin: *\r\nContent-Type: application/json\r\n\r\n" + '{"status":"ok"}'
                conn.sendall(resp.encode())
        conn.close()
    except Exception as e:
        pass

#Final Update