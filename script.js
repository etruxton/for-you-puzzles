document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const gridContainer = document.getElementById('grid-container');
    const wordInput = document.getElementById('word-input');
    const puzzleSelect = document.getElementById('puzzle-select');
    const loadPuzzleBtn = document.getElementById('load-puzzle-btn');
    const randomPuzzleBtn = document.getElementById('random-puzzle-btn');
    const foundWordsList = document.getElementById('found-words-list');
    const bonusWordsList = document.getElementById('bonus-words-list');
    
    // --- Game State ---
    const gridSize = 10;
    const letterPool = "EEEEEEEEAAAAAIIIIIOOOOONNNNNRRRRRTTTTTLLLLSSSSUUUUDDGGGBBCCMMPPFFHHVVWWYYKJXQZ";
    let allPuzzles = [];
    let gridData = [];
    let tileElements = [];
    let originalWords = new Set();
    let allFoundWords = new Set();
    
    const directions = [
        { x: 0, y: 1 }, { x: 0, y: -1 }, { x: 1, y: 0 }, { x: -1, y: 0 },
        { x: 1, y: 1 }, { x: -1, y: -1 }, { x: 1, y: -1 }, { x: -1, y: 1 }
    ];

    // --- Puzzle Loading and Setup ---
    async function setup() {
        try {
            const response = await fetch('puzzles.json');
            if (!response.ok) throw new Error('Network response was not ok.');
            allPuzzles = await response.json();
            
            populateDropdown();
            loadPuzzleBtn.disabled = false;
            randomPuzzleBtn.disabled = false;
            
            // Load the first puzzle by default
            generatePuzzleFromData(allPuzzles[0].words);

        } catch (error) {
            console.error('Failed to load puzzle data:', error);
            gridContainer.textContent = 'Error: Could not load puzzles.';
        }
    }

    function populateDropdown() {
        allPuzzles.forEach((puzzle, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = puzzle.category;
            puzzleSelect.appendChild(option);
        });
    }

    // --- Procedural Generation Logic ---
    function generatePuzzleFromData(words) {
        const inputWords = words.map(w => w.toUpperCase())
            .filter(w => w.length > 0 && w.length <= gridSize)
            .sort((a, b) => b.length - a.length);

        originalWords = new Set(inputWords);
        allFoundWords.clear();
        
        let grid = Array(gridSize).fill(null).map(() => Array(gridSize).fill(null));

        for (const word of inputWords) {
            let placed = false;
            const wordToPlace = Math.random() < 0.5 ? word : word.split('').reverse().join('');
            
            for (let i = 0; i < 100; i++) { // Try 100 times
                const dir = directions[Math.floor(Math.random() * directions.length)];
                const row = Math.floor(Math.random() * gridSize);
                const col = Math.floor(Math.random() * gridSize);
                
                if (canPlaceWord(wordToPlace, grid, row, col, dir)) {
                    placeWord(wordToPlace, grid, row, col, dir);
                    placed = true;
                    break;
                }
            }
        }

        for (let r = 0; r < gridSize; r++) {
            for (let c = 0; c < gridSize; c++) {
                if (grid[r][c] === null) {
                    grid[r][c] = letterPool[Math.floor(Math.random() * letterPool.length)];
                }
            }
        }

        renderGrid(grid);
        foundWordsList.innerHTML = '';
        bonusWordsList.innerHTML = '';
    }

    function canPlaceWord(word, grid, row, col, dir) {
        for (let i = 0; i < word.length; i++) {
            const r = row + i * dir.x;
            const c = col + i * dir.y;
            if (r < 0 || r >= gridSize || c < 0 || c >= gridSize) return false;
            if (grid[r][c] !== null && grid[r][c] !== word[i]) return false;
        }
        return true;
    }

    function placeWord(word, grid, row, col, dir) {
        for (let i = 0; i < word.length; i++) {
            const r = row + i * dir.x;
            const c = col + i * dir.y;
            grid[r][c] = word[i];
        }
    }
    
    // --- Rendering and Game Logic (largely unchanged) ---
    function renderGrid(newGrid) {
        gridData = newGrid;
        gridContainer.innerHTML = '';
        tileElements = [];
        for (let r = 0; r < gridSize; r++) {
            const rowElements = [];
            for (let c = 0; c < gridSize; c++) {
                const letter = gridData[r][c];
                const tile = document.createElement('div');
                tile.className = 'grid-tile';
                tile.textContent = letter;
                gridContainer.appendChild(tile);
                rowElements.push(tile);
            }
            tileElements.push(rowElements);
        }
    }
    
    function findWordOnGrid(word) {
        const wordReversed = word.split('').reverse().join('');
        for (let r = 0; r < gridSize; r++) {
            for (let c = 0; c < gridSize; c++) {
                for (const dir of directions) {
                    let path = checkDirection(word, r, c, dir);
                    if (path) return path;
                    path = checkDirection(wordReversed, r, c, dir);
                    if (path) return path;
                }
            }
        }
        return null;
    }

    function checkDirection(word, r, c, dir) {
        const path = [];
        for (let k = 0; k < word.length; k++) {
            const newR = r + k * dir.x;
            const newC = c + k * dir.y;
            if (newR < 0 || newR >= gridSize || newC < 0 || newC >= gridSize || gridData[newR][newC] !== word[k]) {
                return null;
            }
            path.push({ x: newR, y: newC });
        }
        return path;
    }
    
    function addWordToCorrectList(word) {
        const li = document.createElement('li');
        li.textContent = word;
        li.dataset.word = word;
        if (originalWords.has(word)) {
            foundWordsList.prepend(li);
        } else {
            bonusWordsList.prepend(li);
        }
    }

    function moveWordToTop(word) {
        const li = document.querySelector(`li[data-word="${word}"]`);
        if (li) {
            li.parentElement.prepend(li);
        }
    }
    
    function highlightPath(path) {
        path.forEach(pos => tileElements[pos.x][pos.y].classList.add('highlighted'));
        setTimeout(() => {
            path.forEach(pos => tileElements[pos.x][pos.y].classList.remove('highlighted'));
        }, 1500);
    }

    async function isRealWord(word) {
        if (word.length < 3) return false;
        try {
            const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
            return response.ok;
        } catch (error) {
            console.error("Dictionary API error:", error);
            return false;
        }
    }
    
    async function processGuess(word) {
        word = word.toUpperCase().trim();
        if (word.length < 3) return;

        const path = findWordOnGrid(word);
        if (!path) return;

        if (allFoundWords.has(word)) {
            highlightPath(path);
            moveWordToTop(word);
            wordInput.value = '';
        } else {
            const isWordValid = await isRealWord(word);
            if (!isWordValid) return;
            
            allFoundWords.add(word);
            highlightPath(path);
            addWordToCorrectList(word);
            wordInput.value = '';
        }
    }

    // --- Event Listeners ---
    loadPuzzleBtn.addEventListener('click', () => {
        const selectedIndex = puzzleSelect.value;
        generatePuzzleFromData(allPuzzles[selectedIndex].words);
    });

    randomPuzzleBtn.addEventListener('click', () => {
        const randomIndex = Math.floor(Math.random() * allPuzzles.length);
        puzzleSelect.value = randomIndex; // Sync dropdown
        generatePuzzleFromData(allPuzzles[randomIndex].words);
    });

    wordInput.addEventListener('keyup', (event) => {
        if (event.key === 'Enter') {
            processGuess(wordInput.value);
        }
    });

    // --- Initial Kick-off ---
    loadPuzzleBtn.disabled = true;
    randomPuzzleBtn.disabled = true;
    setup();
});