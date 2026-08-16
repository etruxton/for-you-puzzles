import { describe, it, expect } from 'vitest';

const PLAYER_ID_REGEX = /^[a-zA-Z0-9_-]+$/;
const MAX_PLAYER_ID_LENGTH = 50;
const MAX_WORD_LENGTH = 20;
const MIN_WORD_LENGTH = 3;
const MAX_MESSAGE_SIZE = 1024;

function validatePlayerId(playerId) {
  if (!playerId || typeof playerId !== 'string') return false;
  if (playerId.length > MAX_PLAYER_ID_LENGTH) return false;
  if (!PLAYER_ID_REGEX.test(playerId)) return false;
  return true;
}

function validateWord(word) {
  if (!word || typeof word !== 'string') return false;
  word = word.toUpperCase().trim();
  if (word.length < MIN_WORD_LENGTH || word.length > MAX_WORD_LENGTH) return false;
  if (!/^[A-Z]+$/.test(word)) return false;
  return true;
}

function validateMessage(msg) {
  if (typeof msg !== 'string') return false;
  if (msg.length > MAX_MESSAGE_SIZE) return false;
  try { JSON.parse(msg); return true; } catch { return false; }
}

describe('player ID validation', () => {
  it('accepts valid player IDs', () => {
    expect(validatePlayerId('player-abc123')).toBe(true);
    expect(validatePlayerId('user_name')).toBe(true);
    expect(validatePlayerId('A')).toBe(true);
    expect(validatePlayerId('a'.repeat(50))).toBe(true);
  });

  it('rejects empty or missing player IDs', () => {
    expect(validatePlayerId('')).toBe(false);
    expect(validatePlayerId(null)).toBe(false);
    expect(validatePlayerId(undefined)).toBe(false);
  });

  it('rejects player IDs that are too long', () => {
    expect(validatePlayerId('a'.repeat(51))).toBe(false);
  });

  it('rejects player IDs with invalid characters', () => {
    expect(validatePlayerId('user name')).toBe(false);
    expect(validatePlayerId('user<script>')).toBe(false);
    expect(validatePlayerId('user;DROP TABLE')).toBe(false);
    expect(validatePlayerId('../etc/passwd')).toBe(false);
  });
});

describe('word validation', () => {
  it('accepts valid words', () => {
    expect(validateWord('CAT')).toBe(true);
    expect(validateWord('thunder')).toBe(true);
    expect(validateWord('ABCDEFGHIJ')).toBe(true);
  });

  it('rejects words that are too short', () => {
    expect(validateWord('AB')).toBe(false);
    expect(validateWord('A')).toBe(false);
    expect(validateWord('')).toBe(false);
  });

  it('rejects words that are too long', () => {
    expect(validateWord('A'.repeat(21))).toBe(false);
  });

  it('rejects words with non-alpha characters', () => {
    expect(validateWord('HE LLO')).toBe(false);
    expect(validateWord('WORD!')).toBe(false);
    expect(validateWord('123')).toBe(false);
    expect(validateWord('A-B')).toBe(false);
  });

  it('rejects null/undefined', () => {
    expect(validateWord(null)).toBe(false);
    expect(validateWord(undefined)).toBe(false);
  });
});

describe('WebSocket message validation', () => {
  it('accepts valid JSON messages under size limit', () => {
    const msg = JSON.stringify({ type: 'submit_word', data: { word: 'CAT', playerId: 'player-1' } });
    expect(validateMessage(msg)).toBe(true);
  });

  it('rejects messages over 1KB', () => {
    const msg = JSON.stringify({ data: 'x'.repeat(1025) });
    expect(validateMessage(msg)).toBe(false);
  });

  it('rejects non-string messages', () => {
    expect(validateMessage(123)).toBe(false);
    expect(validateMessage(null)).toBe(false);
    expect(validateMessage({})).toBe(false);
  });

  it('rejects invalid JSON', () => {
    expect(validateMessage('not json')).toBe(false);
    expect(validateMessage('{bad:')).toBe(false);
  });
});

describe('rate limiting logic', () => {
  it('allows up to 10 messages per second', () => {
    let count = 0;
    const rateReset = Date.now() + 1000;
    const maxPerSecond = 10;

    for (let i = 0; i < 15; i++) {
      if (Date.now() > rateReset) { count = 0; }
      count++;
      if (count > maxPerSecond) break;
    }
    expect(count).toBe(11);
  });
});
