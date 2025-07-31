from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from flask_socketio import SocketIO, emit, join_room, leave_room
import random
import string
from datetime import datetime, timedelta, timezone
import threading
import time
import json
import os

app = Flask(__name__, static_folder='static')
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*")

# Grid generation constants
GRID_SIZE = 10
LETTER_POOL = "EEEEEEEEAAAAAIIIIIOOOOONNNNNRRRRRTTTTTLLLLSSSSUUUUDDGGGBBCCMMPPFFHHVVWWYYKJXQZ"
DIRECTIONS = [
    (0, 1), (0, -1), (1, 0), (-1, 0),
    (1, 1), (-1, -1), (1, -1), (-1, 1)
]

# Game state
current_game = None
game_lock = threading.Lock()
game_timer = None  # Store the timer so we can cancel it
results_screen_data = None  # Store results screen info for new clients

# Puzzle database loading
import json

def load_puzzles():
    try:
        with open('data/puzzles.json', 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        print("Warning: data/puzzles.json not found, using default puzzles")
        return [
            {
                "puzzleId": "DEFAULT",
                "category": "Default",
                "words": ["WORD", "SEARCH", "GAME", "PUZZLE", "FIND", "GRID", "LETTERS", "FUN"]
            }
        ]

PUZZLES = load_puzzles()

# Word validation functions
def find_word_on_grid(word, grid_data):
    """Check if a word exists on the grid in any direction"""
    word = word.upper()
    word_reversed = word[::-1]
    
    for r in range(GRID_SIZE):
        for c in range(GRID_SIZE):
            for dx, dy in DIRECTIONS:
                if check_direction(word, r, c, dx, dy, grid_data) or \
                   check_direction(word_reversed, r, c, dx, dy, grid_data):
                    return True
    return False

def check_direction(word, r, c, dx, dy, grid_data):
    """Check if word exists starting at (r,c) in direction (dx,dy)"""
    for k in range(len(word)):
        new_r = r + k * dx
        new_c = c + k * dy
        
        if (new_r < 0 or new_r >= GRID_SIZE or 
            new_c < 0 or new_c >= GRID_SIZE or
            grid_data[new_r][new_c] != word[k]):
            return False
    return True


# Serve static files
@app.route('/')
def serve_index():
    return send_from_directory('static', 'index.html')

# Block access to puzzle data files
@app.route('/puzzles.json')
@app.route('/data/<path:filename>')
def block_puzzle_access(filename=None):
    return jsonify({"error": "Access denied"}), 403

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('static', path)

class GameSession:
    def __init__(self, puzzle):
        self.session_id = self.generate_id()
        self.puzzle_id = puzzle["puzzleId"]
        self.category = puzzle["category"]
        self.words = [w.upper() for w in puzzle["words"]]
        self.grid_data = self.generate_grid()
        # Don't set start_time yet - will be set when game actually starts
        self.start_time = None
        self.end_time = None
        self.found_words = []
        self.status = "PENDING"  # New status for games waiting to start
        self.completion_timer = None  # Timer for early completion
    
    def activate(self):
        """Activate the game session when it's time to start."""
        self.start_time = datetime.now(timezone.utc)
        self.end_time = self.start_time + timedelta(seconds=120)
        self.status = "ACTIVE"
        
    def generate_id(self):
        return ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))
    
    def generate_grid(self):
        max_attempts = 50  # Try up to 50 times to generate a valid grid
        
        for attempt in range(max_attempts):
            grid = [[None for _ in range(GRID_SIZE)] for _ in range(GRID_SIZE)]
            placed_words = []
            
            # Sort words by length (longest first)
            sorted_words = sorted(self.words, key=len, reverse=True)
            
            # Try to place each word
            all_words_placed = True
            for word in sorted_words:
                placed = False
                # Maybe reverse the word
                word_to_place = word if random.random() < 0.5 else word[::-1]
                
                # Collect all valid positions for this word
                valid_positions = []
                for direction in DIRECTIONS:
                    for row in range(GRID_SIZE):
                        for col in range(GRID_SIZE):
                            if self.can_place_word(word_to_place, grid, row, col, direction):
                                valid_positions.append((row, col, direction))
                
                # If there are valid positions, randomly choose one
                if valid_positions:
                    row, col, direction = random.choice(valid_positions)
                    self.place_word(word_to_place, grid, row, col, direction)
                    placed_words.append({
                        'word': word,
                        'placed_word': word_to_place,
                        'row': row,
                        'col': col,
                        'direction': direction
                    })
                    placed = True
                
                if not placed:
                    all_words_placed = False
                    break
            
            # If all words were placed successfully, use this grid
            if all_words_placed:
                # Fill empty cells
                for r in range(GRID_SIZE):
                    for c in range(GRID_SIZE):
                        if grid[r][c] is None:
                            grid[r][c] = random.choice(LETTER_POOL)
                
                print(f"Successfully generated grid on attempt {attempt + 1}")
                print(f"Placed words: {[pw['word'] for pw in placed_words]}")
                return grid
        
        # If we couldn't generate a valid grid after max_attempts, 
        # use a fallback approach with guaranteed placement
        print(f"Warning: Could not generate optimal grid after {max_attempts} attempts. Using fallback method.")
        return self.generate_grid_fallback()
    
    def can_place_word(self, word, grid, row, col, direction):
        dr, dc = direction
        end_row = row + (len(word) - 1) * dr
        end_col = col + (len(word) - 1) * dc
        
        # Check bounds
        if not (0 <= end_row < GRID_SIZE and 0 <= end_col < GRID_SIZE):
            return False
        
        # Check if word fits
        for i, letter in enumerate(word):
            r = row + i * dr
            c = col + i * dc
            if grid[r][c] is not None and grid[r][c] != letter:
                return False
        
        return True
    
    def place_word(self, word, grid, row, col, direction):
        dr, dc = direction
        for i, letter in enumerate(word):
            r = row + i * dr
            c = col + i * dc
            grid[r][c] = letter
    
    def generate_grid_fallback(self):
        """Fallback method that guarantees word placement by using simpler strategy."""
        grid = [[None for _ in range(GRID_SIZE)] for _ in range(GRID_SIZE)]
        
        # Use only horizontal and vertical directions for easier placement
        simple_directions = [(0, 1), (1, 0)]  # right, down
        
        # Sort words by length (longest first)
        sorted_words = sorted(self.words, key=len, reverse=True)
        
        placed_words = []
        
        for word in sorted_words:
            placed = False
            # Try each simple direction
            for direction in simple_directions:
                if placed:
                    break
                
                # Try each position
                for row in range(GRID_SIZE):
                    if placed:
                        break
                    for col in range(GRID_SIZE):
                        if self.can_place_word(word, grid, row, col, direction):
                            self.place_word(word, grid, row, col, direction)
                            placed_words.append({
                                'word': word,
                                'row': row,
                                'col': col,
                                'direction': direction
                            })
                            placed = True
                            break
            
            if not placed:
                print(f"Warning: Could not place word '{word}' even with fallback method")
        
        # Fill empty cells with random letters
        for r in range(GRID_SIZE):
            for c in range(GRID_SIZE):
                if grid[r][c] is None:
                    grid[r][c] = random.choice(LETTER_POOL)
        
        print(f"Fallback grid generated with {len(placed_words)} words placed")
        return grid
    
    def submit_word(self, word, player_id):
        word = word.upper().strip()
        
        # Validate word length
        if len(word) < 3:
            return {
                "success": False,
                "error": "Word too short",
                "word": word,
                "foundWords": self.found_words
            }
        
        # Check if already found
        for found_word in self.found_words:
            if found_word["word"] == word:
                return {
                    "success": False,
                    "word": word,
                    "isBonus": False,
                    "alreadyFound": True,
                    "foundWords": self.found_words
                }
        
        # SECURITY: Validate word exists on grid
        if not find_word_on_grid(word, self.grid_data):
            return {
                "success": False,
                "error": "Word not found on grid",
                "word": word,
                "foundWords": self.found_words
            }
        
        # Check if it's a bonus word
        is_bonus = word not in self.words
        
        # Note: Client already validates real words via dictionary API
        # Server trusts client validation to avoid blocking/timeout issues
        
        # Add to found words
        self.found_words.append({
            "word": word,
            "foundBy": player_id,
            "foundAt": datetime.now(timezone.utc).isoformat(),
            "isBonus": is_bonus
        })
        
        # Check if puzzle is completed
        found_puzzle_words = [fw["word"] for fw in self.found_words if not fw["isBonus"]]
        puzzle_completed = all(word in found_puzzle_words for word in self.words)
        
        return {
            "success": True,
            "word": word,
            "isBonus": is_bonus,
            "alreadyFound": False,
            "foundWords": self.found_words,
            "puzzleCompleted": puzzle_completed,
            "foundBy": player_id
        }
    
    def to_dict(self):
        return {
            "sessionId": self.session_id,
            "puzzleId": self.puzzle_id,
            "category": self.category,
            "words": self.words,
            "gridData": self.grid_data,
            "startTime": self.start_time.isoformat() if self.start_time else None,
            "endTime": self.end_time.isoformat() if self.end_time else None,
            "foundWords": self.found_words,
            "status": self.status
        }

def start_new_game():
    global current_game, game_timer, results_screen_data
    with game_lock:
        # Set simple results screen data if game expired due to time
        if current_game and current_game.status == "ACTIVE":
            results_screen_data = {
                'remainingTime': 10,
                'pendingGame': None  # Will be set when new game is created
            }
        
        # Cancel any existing timers
        if game_timer:
            game_timer.cancel()
        if current_game and current_game.completion_timer:
            current_game.completion_timer.cancel()
        
        # Keep trying until we get a valid game
        max_puzzle_attempts = 10
        for attempt in range(max_puzzle_attempts):
            puzzle = random.choice(PUZZLES)
            new_game = GameSession(puzzle)
            
            # Verify all words can be found in the grid
            if verify_grid(new_game):
                current_game = new_game
                print(f"Created new game: {current_game.session_id} - {current_game.category}")
                print(f"Game will activate in 10 seconds...")
                
                # Update results screen data with pending game info
                if results_screen_data:
                    results_screen_data['pendingGame'] = current_game.to_dict()
                
                # Emit pending game with countdown info
                socketio.emit('game_pending', {
                    'message': 'New game starting soon...',
                    'countdown': 10,
                    'category': current_game.category
                }, room='game')
                
                # Schedule game activation in 10 seconds
                activation_timer = threading.Timer(10.0, activate_and_announce_game)
                activation_timer.daemon = True
                activation_timer.start()
                
                return
            else:
                print(f"Grid verification failed for puzzle {puzzle['category']}, trying another...")
        
        print("ERROR: Could not generate a valid puzzle after multiple attempts!")

def activate_and_announce_game():
    """Activate the pending game and announce it to all players."""
    global game_timer, results_screen_data
    with game_lock:
        if current_game and current_game.status == "PENDING":
            current_game.activate()
            print(f"Activated game: {current_game.session_id}")
            
            # Clear results screen data since new game is starting
            results_screen_data = None
            
            # Emit new game event to all connected clients
            socketio.emit('new_game', current_game.to_dict(), room='game')
            
            # Also emit as current_game to catch any clients that might miss the new_game event
            socketio.emit('current_game', current_game.to_dict(), room='game')
            
            # Schedule the next game for 120 seconds from now
            game_timer = threading.Timer(120.0, start_new_game)
            game_timer.daemon = True
            game_timer.start()

def start_early_completion_timer():
    """Start a 10-second timer when puzzle is completed early."""
    global current_game, results_screen_data
    
    if current_game and current_game.status == "ACTIVE":
        current_game.status = "COMPLETED"
        print("Puzzle completed! Starting new game in 10 seconds...")
        
        # Set simple results screen data to track that we're in results mode
        results_screen_data = {
            'remainingTime': 10,
            'pendingGame': None  # Will be set when new game is created
        }
        
        # Notify all clients that puzzle was completed
        socketio.emit('puzzle_completed', {
            'message': 'Puzzle completed! New game starting in 10 seconds...'
        }, room='game')
        
        # Cancel the existing game timer
        if game_timer:
            game_timer.cancel()
        
        # Clear results screen data in 10 seconds when new game should be ready
        def clear_results_and_notify():
            global results_screen_data
            results_screen_data = None
            # Broadcast current game state to all clients
            if current_game and current_game.status == "ACTIVE":
                socketio.emit('current_game', current_game.to_dict(), room='game')
        
        results_clear_timer = threading.Timer(10.0, clear_results_and_notify)
        results_clear_timer.daemon = True
        results_clear_timer.start()
        
        # Start a new game in 10 seconds
        current_game.completion_timer = threading.Timer(10.0, start_new_game)
        current_game.completion_timer.daemon = True
        current_game.completion_timer.start()

def verify_grid(game_session):
    """Verify that all words can be found in the grid."""
    grid = game_session.grid_data
    words = game_session.words
    
    for word in words:
        found = False
        word_reversed = word[::-1]
        
        # Check all positions and directions
        for row in range(GRID_SIZE):
            for col in range(GRID_SIZE):
                for dr, dc in DIRECTIONS:
                    # Check forward
                    if check_word_at_position(grid, word, row, col, dr, dc):
                        found = True
                        break
                    # Check reversed
                    if check_word_at_position(grid, word_reversed, row, col, dr, dc):
                        found = True
                        break
                if found:
                    break
            if found:
                break
        
        if not found:
            print(f"ERROR: Word '{word}' cannot be found in the grid!")
            return False
    
    return True

def check_word_at_position(grid, word, row, col, dr, dc):
    """Check if a word exists at a specific position and direction."""
    for i, letter in enumerate(word):
        r = row + i * dr
        c = col + i * dc
        
        # Check bounds
        if r < 0 or r >= GRID_SIZE or c < 0 or c >= GRID_SIZE:
            return False
        
        # Check letter match
        if grid[r][c] != letter:
            return False
    
    return True

# API Routes

@app.route('/api/submit-word', methods=['POST'])
def submit_word():
    data = request.json
    session_id = data.get('sessionId')
    word = data.get('word')
    player_id = data.get('playerId')
    
    with game_lock:
        if not current_game or current_game.session_id != session_id:
            return jsonify({"error": "Invalid session"}), 400
        
        if current_game.status != "ACTIVE":
            return jsonify({"error": "Game not active"}), 400
        
        try:
            result = current_game.submit_word(word, player_id)
            
            # Emit word found event to all players if successful
            if result["success"]:
                # Include the word and who found it in the broadcast
                emit_data = {
                    "success": True,
                    "word": result["word"],
                    "isBonus": result["isBonus"],
                    "foundWords": result["foundWords"],
                    "foundBy": result["foundBy"]
                }
                socketio.emit('word_found', emit_data, room='game')
                
                # Check if puzzle is completed
                if result.get("puzzleCompleted", False):
                    start_early_completion_timer()
            
            return jsonify(result)
        except Exception as e:
            print(f"Error in submit_word: {e}")
            return jsonify({"error": "Server error", "success": False}), 500

# WebSocket Events
@socketio.on('connect')
def handle_connect():
    join_room('game')
    print(f"Client connected: {request.sid}")
    
    # Send current state to the new player
    with game_lock:
        if current_game and current_game.status == "ACTIVE":
            emit('current_game', current_game.to_dict())
        elif current_game and current_game.status == "PENDING":
            # Game is pending, tell client to wait
            emit('game_pending', {
                'message': 'New game starting soon...',
                'countdown': 10,  # Approximate countdown
                'category': current_game.category
            })
        elif results_screen_data:
            # During results screen, just show waiting message
            emit('game_pending', {
                'message': 'New game starting soon...',
                'countdown': results_screen_data.get('remainingTime', 10),
                'category': results_screen_data.get('pendingGame', {}).get('category', 'Loading...')
            })

@socketio.on('request_current_game')
def handle_request_current_game():
    with game_lock:
        if current_game and current_game.status == "ACTIVE":
            emit('current_game', current_game.to_dict())
        elif current_game and current_game.status == "PENDING":
            emit('game_pending', {
                'message': 'New game starting soon...',
                'countdown': 10,  # Approximate countdown
                'category': current_game.category
            })
        else:
            emit('current_game', None)

@socketio.on('disconnect')
def handle_disconnect():
    leave_room('game')
    print(f"Client disconnected: {request.sid}")

# Initialize the server
print("Initializing For You Puzzles server...")

# Start the first game immediately active
def start_initial_game():
    """Start the first game immediately in ACTIVE state"""
    global current_game, game_timer
    with game_lock:
        # Keep trying until we get a valid game
        max_puzzle_attempts = 10
        for attempt in range(max_puzzle_attempts):
            puzzle = random.choice(PUZZLES)
            new_game = GameSession(puzzle)
            
            # Verify all words can be found in the grid
            if verify_grid(new_game):
                current_game = new_game
                current_game.activate()  # Activate immediately
                print(f"Started initial game: {current_game.session_id} - {current_game.category}")
                print(f"Game is immediately active and ready to play!")
                
                # Schedule the next game for 120 seconds from now
                game_timer = threading.Timer(120.0, start_new_game)
                game_timer.daemon = True
                game_timer.start()
                
                return
            else:
                print(f"Grid verification failed for puzzle {puzzle['category']}, trying another...")
        
        print("ERROR: Could not generate a valid initial puzzle after multiple attempts!")

start_initial_game()

if __name__ == '__main__':
    # Get port from environment variable (Heroku) or use 5000 locally
    port = int(os.environ.get('PORT', 5000))
    
    # Run the server
    print(f"Starting server on port {port}")
    socketio.run(app, host='0.0.0.0', port=port, debug=False)