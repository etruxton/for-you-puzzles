import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { PUZZLES } from '../src/puzzles.js';

let numBits, numHashes, filter;

function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function djb2(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

function isWord(word) {
  const h1 = fnv1a(word);
  const h2 = djb2(word);
  for (let i = 0; i < numHashes; i++) {
    const bit = ((h1 + Math.imul(i, h2)) >>> 0) % numBits;
    if (!(filter[bit >> 3] & (1 << (bit & 7)))) return false;
  }
  return true;
}

beforeAll(() => {
  const buf = readFileSync(join(__dirname, '..', 'static', 'dictionary.bin'));
  const view = new DataView(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  numBits = view.getUint32(0, true);
  numHashes = view.getUint32(4, true);
  filter = new Uint8Array(buf.buffer, buf.byteOffset + 12, buf.byteLength - 12);
});

describe('bloom filter structure', () => {
  it('has a valid header', () => {
    expect(numBits).toBeGreaterThan(0);
    expect(numHashes).toBeGreaterThan(0);
    expect(numHashes).toBeLessThan(20);
    expect(filter.length).toBe(Math.ceil(numBits / 8));
  });
});

describe('bloom filter has no false negatives for puzzle words', () => {
  for (const puzzle of PUZZLES) {
    it(`all words in "${puzzle.category}" pass the bloom filter`, () => {
      for (const word of puzzle.words) {
        expect(isWord(word), `"${word}" rejected by bloom filter`).toBe(true);
      }
    });
  }
});

describe('bloom filter rejects nonsense', () => {
  const nonsense = ['QZX', 'NWV', 'ZZZZ', 'QQQQ', 'XJKPL', 'BVNMW', 'ZZXQJ', 'FGHWZ'];

  it('rejects random letter sequences', () => {
    let rejected = 0;
    for (const word of nonsense) {
      if (!isWord(word)) rejected++;
    }
    expect(rejected).toBeGreaterThan(nonsense.length / 2);
  });
});

describe('bloom filter accepts common English words', () => {
  const commonWords = ['THE', 'CAT', 'DOG', 'HOUSE', 'WATER', 'THUNDER', 'WEATHER', 'HURRICANE', 'STORM', 'RAIN'];

  for (const word of commonWords) {
    it(`accepts "${word}"`, () => {
      expect(isWord(word), `"${word}" should be in dictionary`).toBe(true);
    });
  }
});
