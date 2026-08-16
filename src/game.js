import { PUZZLES } from './puzzles.js';

export const GRID_SIZE = 10;
const LETTER_POOL = "EEEEEEEEAAAAAIIIIIOOOOONNNNNRRRRRTTTTTLLLLSSSSUUUUDDGGGBBCCMMPPFFHHVVWWYYKJXQZ";
export const DIRECTIONS = [
  [0,1],[0,-1],[1,0],[-1,0],
  [1,1],[-1,-1],[1,-1],[-1,1]
];
const GAME_DURATION_MS = 120_000;
const POST_GAME_DELAY_MS = 10_000;

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 8; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

function canPlaceWord(word, grid, row, col, dr, dc) {
  const endRow = row + (word.length - 1) * dr;
  const endCol = col + (word.length - 1) * dc;
  if (endRow < 0 || endRow >= GRID_SIZE || endCol < 0 || endCol >= GRID_SIZE) return false;
  for (let i = 0; i < word.length; i++) {
    const r = row + i * dr, c = col + i * dc;
    if (grid[r][c] !== null && grid[r][c] !== word[i]) return false;
  }
  return true;
}

function placeWord(word, grid, row, col, dr, dc) {
  for (let i = 0; i < word.length; i++) {
    grid[row + i * dr][col + i * dc] = word[i];
  }
}

function checkWordAtPosition(grid, word, row, col, dr, dc) {
  for (let i = 0; i < word.length; i++) {
    const r = row + i * dr, c = col + i * dc;
    if (r < 0 || r >= GRID_SIZE || c < 0 || c >= GRID_SIZE) return false;
    if (grid[r][c] !== word[i]) return false;
  }
  return true;
}

export function wordExistsInGrid(grid, word) {
  const rev = word.split('').reverse().join('');
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      for (const [dr, dc] of DIRECTIONS) {
        if (checkWordAtPosition(grid, word, r, c, dr, dc)) return true;
        if (checkWordAtPosition(grid, rev, r, c, dr, dc)) return true;
      }
    }
  }
  return false;
}

export function generateGrid(words) {
  for (let attempt = 0; attempt < 50; attempt++) {
    const grid = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(null));
    const wordPositions = {};
    const sorted = [...words].sort((a, b) => b.length - a.length);
    let allPlaced = true;

    for (const word of sorted) {
      const toPlace = Math.random() < 0.5 ? word : word.split('').reverse().join('');
      const valid = [];
      for (const [dr, dc] of DIRECTIONS) {
        for (let r = 0; r < GRID_SIZE; r++) {
          for (let c = 0; c < GRID_SIZE; c++) {
            if (canPlaceWord(toPlace, grid, r, c, dr, dc)) valid.push([r, c, dr, dc]);
          }
        }
      }
      if (valid.length === 0) { allPlaced = false; break; }
      const [row, col, dr, dc] = randomChoice(valid);
      placeWord(toPlace, grid, row, col, dr, dc);
      wordPositions[word] = { row, col, direction: [dr, dc], length: word.length };
    }

    if (!allPlaced) continue;

    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (grid[r][c] === null) grid[r][c] = LETTER_POOL[Math.floor(Math.random() * LETTER_POOL.length)];
      }
    }

    const verified = words.every(w => wordExistsInGrid(grid, w));
    if (verified) return { grid, wordPositions };
  }
  return null;
}

function generateEmojiGrid(words, wordPositions, foundWords) {
  const emojiGrid = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill('⬜'));
  const foundSet = new Set(foundWords.filter(fw => !fw.isBonus).map(fw => fw.word));

  for (const word of words) {
    const pos = wordPositions[word];
    if (!pos) continue;
    const emoji = foundSet.has(word) ? '🟩' : '🟥';
    const [dr, dc] = pos.direction;
    for (let i = 0; i < word.length; i++) {
      const r = pos.row + i * dr, c = pos.col + i * dc;
      if (r >= 0 && r < GRID_SIZE && c >= 0 && c < GRID_SIZE) emojiGrid[r][c] = emoji;
    }
  }
  return emojiGrid.map(row => row.join('')).join('\n');
}

export class GameRoom {
  constructor(state, _env) {
    this.state = state;
    this.sessions = new Set();
    this.game = null;
    this.gameTimer = null;
    this.completionTimer = null;
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === '/api/ws') {
      if (request.headers.get('Upgrade') !== 'websocket') {
        return new Response('Expected WebSocket', { status: 426 });
      }
      const pair = new WebSocketPair();
      this.handleWebSocket(pair[1]);
      return new Response(null, { status: 101, webSocket: pair[0] });
    }

    if (url.pathname === '/api/current-game') {
      if (!this.game || this.game.status !== 'ACTIVE') {
        if (!this.game) this.startNewGame();
        return Response.json(null);
      }
      if (Date.now() > this.game.endTime) {
        this.game.status = 'EXPIRED';
        return Response.json(null);
      }
      return Response.json(this.gameToDict());
    }

    if (url.pathname === '/api/submit-word' && request.method === 'POST') {
      const data = await request.json();
      return this.handleSubmitWord(data);
    }

    return new Response('Not found', { status: 404 });
  }

  handleWebSocket(ws) {
    this.state.acceptWebSocket(ws);
    ws._rateCount = 0;
    ws._rateReset = Date.now() + 1000;
    this.sessions.add(ws);

    if (!this.game) this.startNewGame();

    if (this.game && this.game.status === 'ACTIVE' && Date.now() <= this.game.endTime) {
      ws.send(JSON.stringify({ type: 'current_game', data: this.gameToDict() }));
    }
  }

  async webSocketMessage(ws, msg) {
    if (typeof msg !== 'string' || msg.length > 1024) return;
    const now = Date.now();
    if (now > ws._rateReset) { ws._rateCount = 0; ws._rateReset = now + 1000; }
    if (++ws._rateCount > 10) return;
    try {
      const parsed = JSON.parse(msg);
      if (parsed.type === 'request_current_game') {
        if (this.game && this.game.status === 'ACTIVE' && Date.now() <= this.game.endTime) {
          ws.send(JSON.stringify({ type: 'current_game', data: this.gameToDict() }));
        } else {
          ws.send(JSON.stringify({ type: 'current_game', data: null }));
        }
      } else if (parsed.type === 'submit_word') {
        this.handleSubmitWordWS(parsed.data);
      }
    } catch {}
  }

  async webSocketClose(ws) {
    this.sessions.delete(ws);
  }

  async webSocketError(ws) {
    this.sessions.delete(ws);
  }

  broadcast(message) {
    const json = JSON.stringify(message);
    for (const ws of this.sessions) {
      try { ws.send(json); } catch { this.sessions.delete(ws); }
    }
  }

  startNewGame() {
    if (this.gameTimer) { clearTimeout(this.gameTimer); this.gameTimer = null; }
    if (this.completionTimer) { clearTimeout(this.completionTimer); this.completionTimer = null; }

    for (let i = 0; i < PUZZLES.length * 2; i++) {
      const puzzle = randomChoice(PUZZLES);
      const result = generateGrid(puzzle.words);
      if (!result) continue;

      const now = Date.now();
      this.game = {
        sessionId: generateId(),
        puzzleId: puzzle.puzzleId,
        category: puzzle.category,
        words: puzzle.words,
        gridData: result.grid,
        wordPositions: result.wordPositions,
        startTime: now,
        endTime: now + GAME_DURATION_MS,
        foundWords: [],
        status: 'ACTIVE',
        totalWords: puzzle.words.length,
      };

      this.broadcast({ type: 'new_game', data: this.gameToDict() });

      this.gameTimer = setTimeout(() => this.handleTimeout(), GAME_DURATION_MS);
      return;
    }
  }

  handleTimeout() {
    if (!this.game || this.game.status !== 'ACTIVE') return;
    this.game.status = 'EXPIRED';

    const foundPuzzleWords = new Set(this.game.foundWords.filter(fw => !fw.isBonus).map(fw => fw.word));
    const missedWords = this.game.words.filter(w => !foundPuzzleWords.has(w));

    this.broadcast({
      type: 'game_timeout',
      data: {
        message: "Time's up! New game starting in 10 seconds...",
        emojiGrid: generateEmojiGrid(this.game.words, this.game.wordPositions, this.game.foundWords),
        missedWords,
      }
    });

    this.completionTimer = setTimeout(() => this.startNewGame(), POST_GAME_DELAY_MS);
  }

  recordWord(word, playerId) {
    if (!this.game || this.game.status !== 'ACTIVE') return null;

    if (!playerId || typeof playerId !== 'string' || playerId.length > 50 || !/^[a-zA-Z0-9_-]+$/.test(playerId)) return null;

    word = word.toUpperCase().trim();
    if (!word || word.length < 3 || word.length > 20 || !/^[A-Z]+$/.test(word)) return null;
    if (this.game.foundWords.some(fw => fw.word === word)) return null;

    const isBonus = !this.game.words.includes(word);
    this.game.foundWords.push({ word, foundBy: playerId, foundAt: new Date().toISOString(), isBonus });

    this.broadcast({ type: 'word_found', data: { success: true, word, isBonus, foundWords: this.game.foundWords, foundBy: playerId } });

    const foundPuzzleWords = this.game.foundWords.filter(fw => !fw.isBonus).map(fw => fw.word);
    if (this.game.words.every(w => foundPuzzleWords.includes(w))) {
      this.game.status = 'COMPLETED';
      if (this.gameTimer) { clearTimeout(this.gameTimer); this.gameTimer = null; }
      this.broadcast({
        type: 'puzzle_completed',
        data: { message: 'Puzzle completed! New game starting in 10 seconds...', emojiGrid: generateEmojiGrid(this.game.words, this.game.wordPositions, this.game.foundWords) }
      });
      this.completionTimer = setTimeout(() => this.startNewGame(), POST_GAME_DELAY_MS);
    }

    return { success: true, word, isBonus };
  }

  handleSubmitWordWS(data) {
    if (!data || !data.word || !data.playerId) return;
    this.recordWord(data.word, data.playerId);
  }

  handleSubmitWord(data) {
    const { sessionId, word, playerId } = data;
    if (!sessionId || !word || !playerId) return Response.json({ error: 'Missing required fields' }, { status: 400 });
    if (!this.game || this.game.sessionId !== sessionId || this.game.status !== 'ACTIVE') {
      return Response.json({ error: 'Invalid session' }, { status: 400 });
    }
    const result = this.recordWord(word, playerId);
    if (!result) return Response.json({ success: false, alreadyFound: true });
    return Response.json(result);
  }

  gameToDict() {
    if (!this.game) return null;
    const d = {
      sessionId: this.game.sessionId,
      puzzleId: this.game.puzzleId,
      category: this.game.category,
      gridData: this.game.gridData,
      startTime: new Date(this.game.startTime).toISOString(),
      endTime: new Date(this.game.endTime).toISOString(),
      foundWords: this.game.foundWords,
      status: this.game.status,
      totalWords: this.game.totalWords,
    };
    if (this.game.status === 'COMPLETED' || this.game.status === 'EXPIRED') {
      d.emojiGrid = generateEmojiGrid(this.game.words, this.game.wordPositions, this.game.foundWords);
      const foundSet = new Set(this.game.foundWords.filter(fw => !fw.isBonus).map(fw => fw.word));
      d.missedWords = this.game.words.filter(w => !foundSet.has(w));
    }
    return d;
  }
}
