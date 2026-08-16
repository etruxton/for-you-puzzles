const fs = require('fs');
const path = require('path');

const words = fs.readFileSync(path.join(__dirname, 'words.txt'), 'utf-8')
  .split('\n')
  .map(w => w.trim().toUpperCase())
  .filter(w => w.length >= 3 && w.length <= 10);

const n = words.length;
const bitsPerElement = 10;
const numBits = n * bitsPerElement;
const numBytes = Math.ceil(numBits / 8);
const numHashes = 7;

const buffer = Buffer.alloc(numBytes);

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

function hashBit(h1, h2, i) {
  const combined = (h1 + Math.imul(i, h2)) >>> 0;
  return combined % numBits;
}

function addWord(word) {
  const h1 = fnv1a(word);
  const h2 = djb2(word);
  for (let i = 0; i < numHashes; i++) {
    const bit = hashBit(h1, h2, i);
    buffer[bit >> 3] |= 1 << (bit & 7);
  }
}

for (const word of words) {
  addWord(word);
}

const header = Buffer.alloc(12);
header.writeUInt32LE(numBits, 0);
header.writeUInt32LE(numHashes, 4);
header.writeUInt32LE(words.length, 8);

const out = Buffer.concat([header, buffer]);
fs.writeFileSync(path.join(__dirname, '..', 'static', 'dictionary.bin'), out);

console.log(`Built bloom filter: ${words.length} words, ${numBits} bits (${(out.length / 1024).toFixed(1)}KB), ${numHashes} hashes`);

let fp = 0;
const testNonWords = [];
const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
for (let i = 0; i < 10000; i++) {
  let w = '';
  const len = 3 + Math.floor(Math.random() * 5);
  for (let j = 0; j < len; j++) w += chars[Math.floor(Math.random() * 26)];
  testNonWords.push(w);
}

const wordSet = new Set(words);
for (const w of testNonWords) {
  if (wordSet.has(w)) continue;
  const h1 = fnv1a(w);
  const h2 = djb2(w);
  let match = true;
  for (let i = 0; i < numHashes; i++) {
    const bit = hashBit(h1, h2, i);
    if (!(buffer[bit >> 3] & (1 << (bit & 7)))) { match = false; break; }
  }
  if (match) fp++;
}
console.log(`False positive test: ${fp}/${testNonWords.length} random strings matched (~${(fp/testNonWords.length*100).toFixed(2)}%)`);
