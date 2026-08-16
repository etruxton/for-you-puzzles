# Tests

Run all tests:

```bash
npm test
```

Watch mode (re-runs on file changes):

```bash
npm run test:watch
```

## What we test

### puzzles.test.js

Validates the puzzle data in `src/puzzles.js` and the grid generation logic in `src/game.js`.

**Puzzle data integrity**
- Every puzzle has a unique ID
- No duplicate words within a single puzzle
- All words are uppercase, alpha-only, at least 3 characters
- No word is longer than the grid allows (currently 10x10, but the test reads GRID_SIZE dynamically so it'll catch breakage if we shrink the grid)

**Grid generation**
- Every puzzle in our set can successfully generate a grid
- Generated grids are the correct dimensions with no empty cells
- All cells contain single uppercase letters
- Every word is findable on the generated grid (end-to-end: generate, then search)
- Recorded word positions match what's actually in the grid

**Word search algorithm**
- Finds words placed horizontally, vertically, and diagonally
- Finds reversed words
- Rejects words that aren't on the grid
- Rejects words whose letters exist but aren't contiguous

### bloom.test.js

Validates the bloom filter dictionary (`static/dictionary.bin`) used for word validation on the frontend.

- Filter file has a valid header (bit count, hash count, word count)
- Every word in every puzzle passes the filter (no false negatives for our own content)
- Common English words (THUNDER, WEATHER, etc.) pass the filter
- Random nonsense strings (QZX, NWV) are mostly rejected

If you add new puzzles with compound words (like ICECREAM or FIRETRUCK), run `npm run build:dictionary` to rebuild the filter. The build script pulls words from both `scripts/words.txt` and `src/puzzles.js` so puzzle words are always included.

### validation.test.js

Tests the input validation rules that the server enforces.

**Player ID validation**
- Accepts alphanumeric IDs with hyphens and underscores (max 50 chars)
- Rejects empty, null, too-long, or IDs with special characters

**Word validation**
- Accepts 3-20 character alpha words
- Rejects too-short, too-long, non-alpha, or empty input

**WebSocket message validation**
- Accepts valid JSON under 1KB
- Rejects oversized messages, non-strings, and invalid JSON

**Rate limiting**
- Enforces the 10 messages per second limit

## Adding tests

When adding a new puzzle category, the existing tests will automatically cover it (they iterate over all puzzles). Just make sure to run `npm run build:dictionary` if any words aren't standard dictionary words.

When changing game logic (grid generation, word finding, scoring), add a test case in `puzzles.test.js` that exercises the specific behavior.
