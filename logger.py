#!/usr/bin/env python3
# =============================================================================
#   SENTRON — Terminal Dashboard Server
#   Port  : 8001
#   Route : POST /log  →  player, action, score  (form-encoded)
#   Route : GET  /     →  JSON health check
#   Run   : python server.py
# =============================================================================

import http.server
import urllib.parse
import json
import datetime
import threading
import os
import sys
import time

# ── ANSI COLOUR PALETTE ──────────────────────────────────────────────────────
RESET   = '\033[0m'
BOLD    = '\033[1m'
DIM     = '\033[2m'
ITALIC  = '\033[3m'

BLACK   = '\033[30m'
RED     = '\033[91m'
GREEN   = '\033[92m'
YELLOW  = '\033[93m'
BLUE    = '\033[94m'
PURPLE  = '\033[95m'
CYAN    = '\033[96m'
WHITE   = '\033[97m'

BG_BLACK  = '\033[40m'
BG_DARK   = '\033[48;5;234m'

def c(text, *codes):
    return ''.join(codes) + str(text) + RESET

def pad(text, width):
    """Pad or truncate string to exact width."""
    s = str(text)
    if len(s) > width:
        return s[:width-1] + '…'
    return s.ljust(width)

# ── IN-MEMORY STATE ───────────────────────────────────────────────────────────
state = {
    'sessions'    : {},   # player -> { score, wave, actions, start_time, last_seen }
    'leaderboard' : [],   # list of { player, score, wave, timestamp }
    'total_logs'  : 0,
    'start_time'  : time.time(),
    'lock'        : threading.Lock(),
}

# ── BANNER ────────────────────────────────────────────────────────────────────
BANNER = f"""
{BOLD}{CYAN}
  ███████╗███████╗███╗   ██╗████████╗██████╗  ██████╗ ███╗   ██╗
  ██╔════╝██╔════╝████╗  ██║╚══██╔══╝██╔══██╗██╔═══██╗████╗  ██║
  ███████╗█████╗  ██╔██╗ ██║   ██║   ██████╔╝██║   ██║██╔██╗ ██║
  ╚════██║██╔══╝  ██║╚██╗██║   ██║   ██╔══██╗██║   ██║██║╚██╗██║
  ███████║███████╗██║ ╚████║   ██║   ██║  ██║╚██████╔╝██║ ╚████║
  ╚══════╝╚══════╝╚═╝  ╚═══╝   ╚═╝   ╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═══╝
{RESET}{PURPLE}                  ── Terminal Dashboard ──{RESET}
{DIM}  Listening on port 8001  ·  Route: POST /log{RESET}
"""

# ── ACTION COLOUR MAPPING ─────────────────────────────────────────────────────
def action_color(action):
    a = action.upper()
    if 'BOSS' in a and 'KILL' in a : return GREEN
    if 'BOSS' in a                  : return RED
    if 'SURVIVAL END' in a          : return PURPLE
    if 'SURVIVAL START' in a        : return CYAN
    if 'MISSION START' in a         : return CYAN
    if 'MISSION FAILED' in a        : return RED
    if 'COMBO' in a                 : return YELLOW
    if 'POWER-UP' in a              : return PURPLE
    if 'SHOP' in a                  : return YELLOW
    if 'PAUSED' in a                : return DIM
    if 'RESUMED' in a               : return DIM
    if 'DEVELOPER' in a             : return YELLOW + BOLD
    if 'PULSE' in a or 'NOVA' in a  : return BLUE
    return WHITE

# ── LEADERBOARD UPDATE ────────────────────────────────────────────────────────
def update_leaderboard(player, score, wave):
    with state['lock']:
        lb = state['leaderboard']
        # Remove old entry for this player if it exists
        state['leaderboard'] = [e for e in lb if e['player'] != player]
        state['leaderboard'].append({
            'player'    : player,
            'score'     : int(score),
            'wave'      : int(wave),
            'timestamp' : datetime.datetime.now().strftime('%H:%M:%S'),
        })
        state['leaderboard'].sort(key=lambda x: x['score'], reverse=True)
        state['leaderboard'] = state['leaderboard'][:10]  # top 10

def extract_wave(action):
    """Try to pull WAVE: N from an action string."""
    if 'WAVE:' in action:
        try:
            return int(action.split('WAVE:')[1].strip().split()[0])
        except:
            pass
    return 0

def extract_score(action, fallback=0):
    """Try to pull SCORE: N from an action string."""
    if 'SCORE:' in action:
        try:
            return int(action.split('SCORE:')[1].strip().split()[0])
        except:
            pass
    return fallback

# ── PRINT LOG ENTRY ───────────────────────────────────────────────────────────
def print_log(player, action, score, timestamp):
    ac = action_color(action)
    ts  = c(f'[{timestamp}]', DIM)
    pl  = c(pad(player, 16), BOLD, CYAN)
    sc  = c(f'  ✦ {score}', DIM)
    act = c(action, ac)
    print(f'  {ts} {pl} →  {act}{sc}')

# ── MINI LEADERBOARD PRINT ────────────────────────────────────────────────────
def print_leaderboard():
    lb = state['leaderboard']
    if not lb:
        return
    print(f'\n  {c("─"*58, DIM)}')
    print(f'  {c("  🏆  LEADERBOARD", BOLD, YELLOW)}')
    print(f'  {c("─"*58, DIM)}')
    medals = ['🥇','🥈','🥉','4 ','5 ','6 ','7 ','8 ','9 ','10']
    for i, entry in enumerate(lb[:5]):
        rank  = medals[i] if i < len(medals) else f'{i+1} '
        pname = c(pad(entry["player"], 14), CYAN)
        score = c(pad(entry["score"], 8), WHITE, BOLD)
        wave  = c(f'W{entry["wave"]}', DIM)
        ts    = c(entry["timestamp"], DIM)
        print(f'  {rank}  {pname}  {score}  {wave}  {ts}')
    print(f'  {c("─"*58, DIM)}\n')

# ── SESSION SUMMARY PRINT ─────────────────────────────────────────────────────
def print_session_end(player, score, wave, duration):
    print(f'\n  {c("┌──────────────────────────────────────────────┐", PURPLE)}')
    print(f'  {c("│", PURPLE)}  {c("SESSION END", BOLD, PURPLE)}  {c("│", PURPLE)}')
    print(f'  {c("│", PURPLE)}  Pilot  : {c(player, CYAN, BOLD):<30}{c("│", PURPLE)}')
    print(f'  {c("│", PURPLE)}  Score  : {c(score,  YELLOW, BOLD):<30}{c("│", PURPLE)}')
    print(f'  {c("│", PURPLE)}  Wave   : {c(wave,   WHITE):<30}{c("│", PURPLE)}')
    print(f'  {c("│", PURPLE)}  Time   : {c(duration, DIM):<30}{c("│", PURPLE)}')
    print(f'  {c("└──────────────────────────────────────────────┘", PURPLE)}\n')

# ── HTTP REQUEST HANDLER ──────────────────────────────────────────────────────
class SentronHandler(http.server.BaseHTTPRequestHandler):

    def log_message(self, fmt, *args):
        pass  # suppress default http.server access log (we do our own)

    def send_cors(self):
        self.send_header('Access-Control-Allow-Origin',  '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    # ── OPTIONS (CORS preflight) ──────────────────────────────────────────────
    def do_OPTIONS(self):
        self.send_response(204)
        self.send_cors()
        self.end_headers()

    # ── GET / (health check) ──────────────────────────────────────────────────
    def do_GET(self):
        if self.path == '/':
            payload = json.dumps({
                'status'      : 'online',
                'uptime_s'    : round(time.time() - state['start_time']),
                'total_logs'  : state['total_logs'],
                'sessions'    : len(state['sessions']),
                'leaderboard' : state['leaderboard'][:5],
            }).encode()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_cors()
            self.end_headers()
            self.wfile.write(payload)
        else:
            self.send_response(404)
            self.end_headers()

    # ── POST /log ─────────────────────────────────────────────────────────────
    def do_POST(self):
        if self.path != '/log':
            self.send_response(404)
            self.end_headers()
            return

        length = int(self.headers.get('Content-Length', 0))
        body   = self.rfile.read(length).decode('utf-8', errors='replace')
        params = urllib.parse.parse_qs(body)

        player = params.get('player', ['Unknown'])[0].strip() or 'Pilot'
        action = params.get('action', ['?'])[0].strip()
        score  = params.get('score',  ['0'])[0].strip()

        try:
            score_int = int(float(score))
        except:
            score_int = 0

        now = datetime.datetime.now()
        ts  = now.strftime('%H:%M:%S')

        with state['lock']:
            state['total_logs'] += 1

            if player not in state['sessions']:
                state['sessions'][player] = {
                    'score'      : 0,
                    'wave'       : 1,
                    'actions'    : 0,
                    'start_time' : now,
                    'last_seen'  : now,
                }

            sess = state['sessions'][player]
            sess['actions']  += 1
            sess['last_seen'] = now
            sess['score']     = max(sess['score'], score_int)

            # Track wave from action string
            w = extract_wave(action)
            if w > 0:
                sess['wave'] = max(sess['wave'], w)

        # Print the log entry
        print_log(player, action, score_int, ts)

        # On game/session end: print summary + update leaderboard
        end_actions = ('SURVIVAL END', 'MISSION FAILED')
        if any(a in action.upper() for a in end_actions):
            with state['lock']:
                sess = state['sessions'].get(player, {})
                start = sess.get('start_time', now)
                wave  = sess.get('wave', 1)
                dur_s = int((now - start).total_seconds())
                dur   = f'{dur_s//60}m {dur_s%60}s'

            update_leaderboard(player, score_int, wave)
            print_session_end(player, score_int, wave, dur)
            print_leaderboard()

        # Boss kill milestone
        if 'BOSS KILLED' in action.upper():
            print(f'  {c("  ★ BOSS DESTROYED", BOLD, GREEN)}  {c(player, CYAN)}  '
                  f'{c(f"score {score_int}", DIM)}')

        # New developer cheat activated
        if 'DEVELOPER' in action.upper():
            print(f'  {c("  ⚡ DEVELOPER MODE", BOLD, YELLOW)}  {c(player, CYAN)}')

        # Send response
        resp = json.dumps({'status': 'ok', 'logs': state['total_logs']}).encode()
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_cors()
        self.end_headers()
        self.wfile.write(resp)


# ── STATUS TICKER (prints stats every 60s in background) ─────────────────────
def status_ticker():
    while True:
        time.sleep(60)
        uptime = int(time.time() - state['start_time'])
        mins   = uptime // 60
        secs   = uptime % 60
        active = len(state['sessions'])
        total  = state['total_logs']
        print(f'\n  {c("·", DIM)}  uptime {c(f"{mins}m{secs}s", CYAN)}  '
              f'·  sessions {c(active, YELLOW)}  '
              f'·  total logs {c(total, GREEN)}\n')


# ── MAIN ──────────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    PORT = 8001

    print(BANNER)
    print(f'  {c("PORT", DIM)}      {c(PORT, CYAN, BOLD)}')
    print(f'  {c("ENDPOINT", DIM)}  {c(f"http://localhost:{PORT}/log", CYAN)}')
    print(f'  {c("HEALTH", DIM)}    {c(f"http://localhost:{PORT}/", CYAN)}')
    print(f'\n  {c("Waiting for connections…", DIM)}\n')
    print(f'  {c("─"*58, DIM)}\n')

    # Start background ticker
    ticker = threading.Thread(target=status_ticker, daemon=True)
    ticker.start()

    try:
        server = http.server.HTTPServer(('0.0.0.0', PORT), SentronHandler)
        server.serve_forever()
    except KeyboardInterrupt:
        uptime = int(time.time() - state['start_time'])
        print(f'\n\n  {c("Server stopped.", DIM)}  '
              f'Uptime: {c(f"{uptime//60}m{uptime%60}s", CYAN)}  '
              f'Logs: {c(state["total_logs"], YELLOW)}\n')
        sys.exit(0)