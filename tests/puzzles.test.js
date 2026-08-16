import { describe, it, expect } from 'vitest';
import { PUZZLES } from '../src/puzzles.js';
import { GRID_SIZE, DIRECTIONS, generateGrid, wordExistsInGrid } from '../src/game.js';

describe('puzzle data integrity', () => {
  it('every puzzle has a unique ID', () => {
    const ids = PUZZLES.map(p => p.puzzleId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every puzzle has a category and non-empty word list', () => {
    for (const puzzle of PUZZLES) {
      expect(puzzle.category).toBeTruthy();
      expect(puzzle.words.length).toBeGreaterThan(0);
    }
  });

  it('no duplicate words within a single puzzle', () => {
    for (const puzzle of PUZZLES) {
      const unique = new Set(puzzle.words);
      expect(unique.size, `duplicate in ${puzzle.puzzleId}`).toBe(puzzle.words.length);
    }
  });

  it('all words are uppercase alpha only', () => {
    for (const puzzle of PUZZLES) {
      for (const word of puzzle.words) {
        expect(word, `bad word "${word}" in ${puzzle.puzzleId}`).toMatch(/^[A-Z]+$/);
      }
    }
  });

  it('all words are at least 3 characters', () => {
    for (const puzzle of PUZZLES) {
      for (const word of puzzle.words) {
        expect(word.length, `"${word}" in ${puzzle.puzzleId} too short`).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('no word exceeds the grid size', () => {
    for (const puzzle of PUZZLES) {
      for (const word of puzzle.words) {
        expect(
          word.length,
          `"${word}" in ${puzzle.puzzleId} is ${word.length} chars but grid is ${GRID_SIZE}x${GRID_SIZE}`
        ).toBeLessThanOrEqual(GRID_SIZE);
      }
    }
  });
});

describe('grid generation', () => {
  it('generates a grid with no null cells', () => {
    const puzzle = PUZZLES[0];
    const result = generateGrid(puzzle.words);
    expect(result).not.toBeNull();
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        expect(result.grid[r][c], `cell [${r}][${c}] is null`).not.toBeNull();
      }
    }
  });

  it('generates a grid of the correct dimensions', () => {
    const puzzle = PUZZLES[0];
    const result = generateGrid(puzzle.words);
    expect(result).not.toBeNull();
    expect(result.grid.length).toBe(GRID_SIZE);
    for (const row of result.grid) {
      expect(row.length).toBe(GRID_SIZE);
    }
  });

  it('all cells contain single uppercase letters', () => {
    const puzzle = PUZZLES[0];
    const result = generateGrid(puzzle.words);
    expect(result).not.toBeNull();
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        expect(result.grid[r][c]).toMatch(/^[A-Z]$/);
      }
    }
  });

  it('every word is findable on the generated grid', () => {
    const puzzle = PUZZLES[0];
    const result = generateGrid(puzzle.words);
    expect(result).not.toBeNull();
    for (const word of puzzle.words) {
      expect(
        wordExistsInGrid(result.grid, word),
        `"${word}" not found on grid`
      ).toBe(true);
    }
  });

  it('every puzzle can generate a valid grid', () => {
    for (const puzzle of PUZZLES) {
      const result = generateGrid(puzzle.words);
      expect(result, `failed to generate grid for ${puzzle.puzzleId}`).not.toBeNull();
      for (const word of puzzle.words) {
        expect(
          wordExistsInGrid(result.grid, word),
          `"${word}" not found on grid for ${puzzle.puzzleId}`
        ).toBe(true);
      }
    }
  });

  it('word positions match actual grid content', () => {
    const puzzle = PUZZLES[0];
    const result = generateGrid(puzzle.words);
    expect(result).not.toBeNull();
    for (const word of puzzle.words) {
      const pos = result.wordPositions[word];
      expect(pos, `no position for "${word}"`).toBeDefined();
      const [dr, dc] = pos.direction;
      for (let i = 0; i < word.length; i++) {
        const r = pos.row + i * dr;
        const c = pos.col + i * dc;
        const cell = result.grid[r][c];
        const fwd = word[i];
        const rev = word[word.length - 1 - i];
        expect(
          cell === fwd || cell === rev,
          `cell [${r}][${c}]="${cell}" doesn't match "${word}" at index ${i}`
        ).toBe(true);
      }
    }
  });
});

describe('wordExistsInGrid', () => {
  it('finds a word placed horizontally', () => {
    const grid = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill('X'));
    grid[0][0] = 'C'; grid[0][1] = 'A'; grid[0][2] = 'T';
    expect(wordExistsInGrid(grid, 'CAT')).toBe(true);
  });

  it('finds a word placed in reverse', () => {
    const grid = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill('X'));
    grid[0][0] = 'T'; grid[0][1] = 'A'; grid[0][2] = 'C';
    expect(wordExistsInGrid(grid, 'CAT')).toBe(true);
  });

  it('finds a word placed vertically', () => {
    const grid = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill('X'));
    grid[0][0] = 'C'; grid[1][0] = 'A'; grid[2][0] = 'T';
    expect(wordExistsInGrid(grid, 'CAT')).toBe(true);
  });

  it('finds a word placed diagonally', () => {
    const grid = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill('X'));
    grid[0][0] = 'C'; grid[1][1] = 'A'; grid[2][2] = 'T';
    expect(wordExistsInGrid(grid, 'CAT')).toBe(true);
  });

  it('does not find a word that is not on the grid', () => {
    const grid = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill('X'));
    expect(wordExistsInGrid(grid, 'CAT')).toBe(false);
  });

  it('does not find a word split across non-contiguous cells', () => {
    const grid = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill('X'));
    grid[0][0] = 'C'; grid[0][2] = 'A'; grid[0][4] = 'T';
    expect(wordExistsInGrid(grid, 'CAT')).toBe(false);
  });
});
