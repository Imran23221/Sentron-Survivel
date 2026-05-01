from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime

app = Flask(__name__)
CORS(app)

@app.route('/log', methods=['POST'])
def log_activity():
    data = request.json
    player = data.get('player', 'Pilot')
    action = data.get('action', 'Unknown')
    timestamp = datetime.now().strftime("%H:%M:%S")
    
    print("╔══════════════════════════════════════════╗")
    print(f"║ [{timestamp}] PILOT: {player.upper():<15} ║")
    print(f"║ ACTION: {action:<32} ║")
    print("╚══════════════════════════════════════════╝")
    
    return jsonify({"status": "success"}), 200

if __name__ == '__main__':
    app.run(port=8001)