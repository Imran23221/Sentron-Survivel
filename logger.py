#!/usr/bin/env python3
# =============================================================================
#   SENTRON — Terminal Dashboard Server
#   Port     : 8001
#   Endpoint : POST /log  { player, action, score }
#   Health   : GET  /     returns JSON stats
#   Run with : python3 server.py
# =============================================================================

import http.server
import urllib.parse
import json
import datetime
import threading
import time
import sys

# ── ANSI COLOURS ─────────────────────────────────────────────────────────────
R  = '\033[0m'    # reset
B  = '\033[1m'    # bold
D  = '\033[2m'    # dim
CY = '\033[96m'   # cyan
PU = '\033[95m'   # purple / magenta
GR = '\033[92m'   # green
YE = '\033[93m'   # yellow
RE = '\033[91m'   # red
WH = '\033[97m'   # white
BL = '\033[94m'   # blue

def clr(text, *codes):
    return ''.join(codes) + str(text) + R

def trunc(text, n):
    s = str(text)
    return s if len(s) <= n else s[:n-1] + '…'

# ── SHARED STATE ──────────────────────────────────────────────────────────────
_lock = threading.Lock()
_sessions    = {}   # player -> { score, wave, action_count, start_time }
_leaderboard = []   # [{ player, score, wave, ts }]  top-10
_total_logs  = 0
_server_start = time.time()

# ── ACTION → COLOUR ───────────────────────────────────────────────────────────
def acolor(action):
    a = action.upper()
    if 'BOSS' in a and 'KILL' in a:  return GR
    if 'BOSS INCOMING' in a:         return RE
    if 'SURVIVAL END' in a:          return PU
    if 'SURVIVAL START' in a:        return CY
    if 'MISSION START' in a:         return CY
    if 'MISSION FAILED' in a:        return RE
    if 'COMBO' in a:                 return YE
    if 'POWER-UP' in a:             return PU
    if 'SHOP' in a:                  return YE
    if 'DEVELOPER' in a:             return YE+B
    if 'PAUSED' in a or 'RESUMED' in a: return D
    if 'PULSE' in a or 'NOVA' in a:  return BL
    if 'STREAK' in a:                return YE
    if 'PERFECT' in a:               return GR+B
    return WH

# ── UPDATE LEADERBOARD ────────────────────────────────────────────────────────
def update_lb(player, score, wave):
    with _lock:
        global _leaderboard
        _leaderboard = [e for e in _leaderboard if e['player'] != player]
        _leaderboard.append({
            'player': player,
            'score':  int(score),
            'wave':   int(wave),
            'ts':     datetime.datetime.now().strftime('%H:%M')
        })
        _leaderboard.sort(key=lambda x: x['score'], reverse=True)
        _leaderboard = _leaderboard[:10]

def get_wave_from_action(action):
    if 'WAVE:' in action.upper():
        try:
            return int(action.upper().split('WAVE:')[1].strip().split()[0])
        except:
            pass
    return 0

# ── PRINT HELPERS ─────────────────────────────────────────────────────────────
def line(char='─', n=64):
    print(' ', clr(char * n, D))

def print_log_entry(ts, player, action, score):
    ts_str  = clr(f'[{ts}]', D)
    pl_str  = clr(trunc(player, 14).ljust(14), B, CY)
    sc_str  = clr(f'{str(score).rjust(7)}', D)
    act_str = clr(action, acolor(action))
    print(f'  {ts_str}  {pl_str}  {act_str}  {sc_str}')

def print_session_box(player, score, wave, duration):
    print()
    print(f'  {clr("╔══════════════════════════════════════════════════════╗", PU)}')
    print(f'  {clr("║", PU)}  {clr("SESSION COMPLETE", B+PU)}{" "*36}{clr("║", PU)}')
    print(f'  {clr("║", PU)}  PILOT  : {clr(trunc(player,42), B+CY)}{clr("║", PU)}')
    print(f'  {clr("║", PU)}  SCORE  : {clr(str(score).ljust(42), B+YE)}{clr("║", PU)}')
    print(f'  {clr("║", PU)}  WAVE   : {clr(str(wave).ljust(42), WH)}{clr("║", PU)}')
    print(f'  {clr("║", PU)}  TIME   : {clr(str(duration).ljust(42), D)}{clr("║", PU)}')
    print(f'  {clr("╚══════════════════════════════════════════════════════╝", PU)}')
    print()

def print_leaderboard():
    with _lock:
        lb = list(_leaderboard)
    if not lb:
        return
    print()
    line()
    print(f'  {clr("  🏆  TOP PILOTS", B+YE)}')
    line()
    medals = ['🥇', '🥈', '🥉', ' 4', ' 5', ' 6', ' 7', ' 8', ' 9', '10']
    for i, e in enumerate(lb[:5]):
        m  = medals[i] if i < len(medals) else f'{i+1}'
        pl = clr(trunc(e['player'], 16).ljust(16), CY)
        sc = clr(str(e['score']).rjust(9), B+WH)
        wv = clr(f'W{e["wave"]}'.ljust(4), D)
        ts = clr(e['ts'], D)
        print(f'  {m}  {pl}  {sc}  {wv}  {ts}')
    line()
    print()

# ── HTTP HANDLER ──────────────────────────────────────────────────────────────
class SentronHandler(http.server.BaseHTTPRequestHandler):

    def log_message(self, *args):
        pass  # suppress default access log — we have our own

    def _cors(self):
        self.send_header('Access-Control-Allow-Origin',  '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.send_header('Access-Control-Max-Age', '86400')

    def _json(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type',   'application/json; charset=utf-8')
        self.send_header('Content-Length', len(body))
        self._cors()
        self.end_headers()
        self.wfile.write(body)

    # OPTIONS — CORS preflight
    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    # GET / — health + stats
    def do_GET(self):
        if self.path == '/':
            uptime = int(time.time() - _server_start)
            with _lock:
                self._json({
                    'status':      'online',
                    'uptime_s':    uptime,
                    'total_logs':  _total_logs,
                    'sessions':    len(_sessions),
                    'leaderboard': _leaderboard[:5],
                })
        else:
            self._json({'error': 'not found'}, 404)

    # POST /log — receive game event
    def do_POST(self):
        if self.path != '/log':
            self._json({'error': 'not found'}, 404)
            return

        try:
            length = int(self.headers.get('Content-Length', 0))
            body   = self.rfile.read(length).decode('utf-8', errors='replace')
            params = urllib.parse.parse_qs(body, keep_blank_values=True)

            player = (params.get('player', ['Pilot'])[0]).strip() or 'Pilot'
            action = (params.get('action', ['?'])[0]).strip()
            raw_sc = (params.get('score',  ['0'])[0]).strip()

            try:
                score = int(float(raw_sc))
            except:
                score = 0

            now = datetime.datetime.now()
            ts  = now.strftime('%H:%M:%S')

            # Update session state
            global _total_logs
            with _lock:
                _total_logs += 1
                if player not in _sessions:
                    _sessions[player] = {
                        'score':      0,
                        'wave':       1,
                        'actions':    0,
                        'start_time': now,
                    }
                sess = _sessions[player]
                sess['actions'] += 1
                sess['score']    = max(sess['score'], score)
                w = get_wave_from_action(action)
                if w > 0:
                    sess['wave'] = max(sess['wave'], w)

            # Print the log line
            print_log_entry(ts, player, action, score)

            # Special events: boss killed
            if 'BOSS KILLED' in action.upper():
                print(f'  {clr("  ⭐ BOSS DESTROYED", B+GR)}  '
                      f'{clr(player, CY)}')

            # Developer cheat
            if 'DEVELOPER CHEAT' in action.upper():
                print(f'  {clr("  ⚡ DEV MODE", B+YE)}  {clr(player, CY)}')

            # Combo reward
            if 'COMBO REWARD' in action.upper() or 'STREAK' in action.upper():
                print(f'  {clr("  🔥 COMBO", YE)}  {clr(player, CY)}  {clr(action, D)}')

            # Session end
            end_triggers = ('SURVIVAL END', 'MISSION FAILED')
            if any(t in action.upper() for t in end_triggers):
                with _lock:
                    sess      = _sessions.get(player, {})
                    start     = sess.get('start_time', now)
                    wave      = sess.get('wave', 1)
                    elapsed   = int((now - start).total_seconds())
                    dur       = f'{elapsed // 60}m {elapsed % 60}s'

                update_lb(player, score, wave)
                print_session_box(player, score, wave, dur)
                print_leaderboard()

            # Send OK response
            with _lock:
                total = _total_logs
            self._json({'status': 'ok', 'logs': total})

        except Exception as e:
            print(f'  {clr(f"[ERROR] {e}", RE)}')
            self._json({'status': 'error', 'message': str(e)}, 500)

# ── BACKGROUND STATS TICKER ───────────────────────────────────────────────────
def stats_ticker():
    while True:
        time.sleep(120)
        with _lock:
            uptime  = int(time.time() - _server_start)
            sess_n  = len(_sessions)
            log_n   = _total_logs
        mins = uptime // 60
        print(f'\n  {clr("·", D)}  uptime {clr(f"{mins}m", CY)}'
              f'  ·  pilots {clr(sess_n, YE)}'
              f'  ·  logs {clr(log_n, GR)}\n')

# ── MAIN ──────────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    PORT = 8001

    banner = f"""
{B+CY}
  ███████╗███████╗███╗   ██╗████████╗██████╗  ██████╗ ███╗   ██╗
  ██╔════╝██╔════╝████╗  ██║╚══██╔══╝██╔══██╗██╔═══██╗████╗  ██║
  ███████╗█████╗  ██╔██╗ ██║   ██║   ██████╔╝██║   ██║██╔██╗ ██║
  ╚════██║██╔══╝  ██║╚██╗██║   ██║   ██╔══██╗██║   ██║██║╚██╗██║
  ███████║███████╗██║ ╚████║   ██║   ██║  ██║╚██████╔╝██║ ╚████║
  ╚══════╝╚══════╝╚═╝  ╚═══╝   ╚═╝   ╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═══╝
{R}{PU}                  ── Terminal Dashboard · port {PORT} ──{R}
"""
    print(banner)

    print(f'  {clr("ENDPOINT", D)}   {clr(f"POST http://0.0.0.0:{PORT}/log", CY)}')
    print(f'  {clr("HEALTH",   D)}   {clr(f"GET  http://0.0.0.0:{PORT}/",    CY)}')
    print(f'  {clr("FIELDS",   D)}   player · action · score  (form-encoded)')
    print()
    line()
    print(f'  {"TIMESTAMP".ljust(12)}  {"PILOT".ljust(14)}  ACTION                              SCORE')
    line()

    threading.Thread(target=stats_ticker, daemon=True).start()

    try:
        httpd = http.server.HTTPServer(('0.0.0.0', PORT), SentronHandler)
        httpd.serve_forever()
    except KeyboardInterrupt:
        elapsed = int(time.time() - _server_start)
        print(f'\n\n  {clr("Shutting down.", D)}  '
              f'Uptime: {clr(f"{elapsed//60}m{elapsed%60}s", CY)}  '
              f'Total logs: {clr(_total_logs, YE)}\n')
        sys.exit(0)