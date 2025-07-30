document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const gridContainer = document.getElementById('grid-container');
    const wordInput = document.getElementById('word-input');
    const puzzleTitle = document.getElementById('puzzle-title');
    const foundCount = document.getElementById('found-count');
    const totalCount = document.getElementById('total-count');
    const foundWordsList = document.getElementById('found-words-list');
    const bonusWordsList = document.getElementById('bonus-words-list');
    const celebrationOverlay = document.getElementById('celebration-overlay');
    const countdownElement = document.getElementById('countdown');
    const timeRemaining = document.getElementById('time-remaining');
    const bonusCount = document.getElementById('bonus-count');
    const summaryOverlay = document.getElementById('summary-overlay');
    const summaryCountdown = document.getElementById('summary-countdown');
    
    // --- Game State ---
    const gridSize = 10;
    const letterPool = "EEEEEEEEAAAAAIIIIIOOOOONNNNNRRRRRTTTTTLLLLSSSSUUUUDDGGGBBCCMMPPFFHHVVWWYYKJXQZ";
    let allPuzzles = [];
    let gridData = [];
    let tileElements = [];
    let originalWords = new Set();
    let allFoundWords = new Set();
    let foundOriginalWords = new Set();
    let bonusWordsFound = 0;
    let bonusWordsArray = [];
    let currentPuzzleIndex = 0;
    let previousPuzzleIndex = -1;
    let autoRandomizeInterval = null;
    let timerInterval = null;
    let timeLeft = 120; // 120 seconds
    let puzzleStartTime = null;
    
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
            
            // Start with a random puzzle
            loadRandomPuzzle();
            
            // Set up automatic randomization every 120 seconds
            autoRandomizeInterval = setInterval(showSummaryScreen, 120000);
            
            // Start the countdown timer
            startTimer();

        } catch (error) {
            console.error('Failed to load puzzle data:', error);
            gridContainer.textContent = 'Error: Could not load puzzles.';
        }
    }

    function loadRandomPuzzle() {
        previousPuzzleIndex = currentPuzzleIndex;
        
        // Ensure we get a different puzzle
        do {
            currentPuzzleIndex = Math.floor(Math.random() * allPuzzles.length);
        } while (currentPuzzleIndex === previousPuzzleIndex && allPuzzles.length > 1);
        
        const puzzle = allPuzzles[currentPuzzleIndex];
        puzzleTitle.textContent = puzzle.category;
        generatePuzzleFromData(puzzle.words);
        
        // Reset timer
        timeLeft = 120;
        updateTimerDisplay();
        puzzleStartTime = Date.now();
    }

    // --- Procedural Generation Logic ---
    function generatePuzzleFromData(words) {
        const inputWords = words.map(w => w.toUpperCase())
            .filter(w => w.length > 0 && w.length <= gridSize)
            .sort((a, b) => b.length - a.length);

        originalWords = new Set(inputWords);
        allFoundWords.clear();
        foundOriginalWords.clear();
        bonusWordsFound = 0;
        bonusWordsArray = [];
        updateWordsCounter();
        
        let grid = null;
        let attempts = 0;
        const maxAttempts = 50;
        
        // Keep trying until we successfully place all words
        while (attempts < maxAttempts) {
            grid = Array(gridSize).fill(null).map(() => Array(gridSize).fill(null));
            let allWordsPlaced = true;
            
            for (const word of inputWords) {
                let placed = false;
                const wordToPlace = Math.random() < 0.5 ? word : word.split('').reverse().join('');
                
                // Try more positions and directions
                for (let i = 0; i < 200; i++) {
                    const dir = directions[Math.floor(Math.random() * directions.length)];
                    const row = Math.floor(Math.random() * gridSize);
                    const col = Math.floor(Math.random() * gridSize);
                    
                    if (canPlaceWord(wordToPlace, grid, row, col, dir)) {
                        placeWord(wordToPlace, grid, row, col, dir);
                        placed = true;
                        break;
                    }
                }
                
                if (!placed) {
                    allWordsPlaced = false;
                    break;
                }
            }
            
            if (allWordsPlaced) {
                break; // Success!
            }
            
            attempts++;
        }
        
        // If we couldn't place all words after many attempts, log a warning
        if (attempts === maxAttempts) {
            console.warn('Could not place all words after', maxAttempts, 'attempts');
        }

        // Fill empty cells with random letters
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
        // First check if word fits in bounds
        const endRow = row + (word.length - 1) * dir.x;
        const endCol = col + (word.length - 1) * dir.y;
        if (endRow < 0 || endRow >= gridSize || endCol < 0 || endCol >= gridSize) return false;
        if (row < 0 || row >= gridSize || col < 0 || col >= gridSize) return false;
        
        // Check each position
        for (let i = 0; i < word.length; i++) {
            const r = row + i * dir.x;
            const c = col + i * dir.y;
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
            if (originalWords.has(word)) {
                foundOriginalWords.add(word);
                checkForCompletion();
            } else {
                bonusWordsFound++;
                bonusWordsArray.push(word);
            }
            updateWordsCounter();
            highlightPath(path);
            addWordToCorrectList(word);
            wordInput.value = '';
        }
    }

    // --- Helper Functions ---
    function updateWordsCounter() {
        foundCount.textContent = foundOriginalWords.size;
        totalCount.textContent = originalWords.size;
        bonusCount.textContent = bonusWordsFound;
    }
    
    function startTimer() {
        if (timerInterval) {
            clearInterval(timerInterval);
        }
        
        timerInterval = setInterval(() => {
            timeLeft--;
            updateTimerDisplay();
            
            if (timeLeft <= 0) {
                timeLeft = 120;
            }
        }, 1000);
    }
    
    function showSummaryScreen() {
        // Stop the timers
        if (timerInterval) {
            clearInterval(timerInterval);
        }
        if (autoRandomizeInterval) {
            clearInterval(autoRandomizeInterval);
        }
        
        // Populate summary data
        document.getElementById('summary-found').textContent = foundOriginalWords.size;
        document.getElementById('summary-total').textContent = originalWords.size;
        document.getElementById('summary-bonus').textContent = bonusWordsFound;
        
        // Show missed words
        const missedWords = document.getElementById('missed-words');
        missedWords.innerHTML = '';
        originalWords.forEach(word => {
            if (!foundOriginalWords.has(word)) {
                const span = document.createElement('span');
                span.className = 'missed';
                span.textContent = word;
                missedWords.appendChild(span);
            }
        });
        
        // Show found words
        const foundWordsSummary = document.getElementById('found-words-summary');
        foundWordsSummary.innerHTML = '';
        foundOriginalWords.forEach(word => {
            const span = document.createElement('span');
            span.className = 'found';
            span.textContent = word;
            foundWordsSummary.appendChild(span);
        });
        
        // Show bonus words
        const bonusWordsSummary = document.getElementById('bonus-words-summary');
        bonusWordsSummary.innerHTML = '';
        bonusWordsArray.forEach(word => {
            const span = document.createElement('span');
            span.className = 'bonus';
            span.textContent = word;
            bonusWordsSummary.appendChild(span);
        });
        
        // Show the overlay
        summaryOverlay.classList.remove('hidden');
        
        // Start countdown
        let countdown = 10;
        summaryCountdown.textContent = countdown;
        
        const countdownInterval = setInterval(() => {
            countdown--;
            summaryCountdown.textContent = countdown;
            
            if (countdown <= 0) {
                clearInterval(countdownInterval);
                summaryOverlay.classList.add('hidden');
                loadRandomPuzzle();
                // Restart the auto-randomize timer
                autoRandomizeInterval = setInterval(showSummaryScreen, 120000);
                startTimer();
            }
        }, 1000);
    }
    
    function updateTimerDisplay() {
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        timeRemaining.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    function checkForCompletion() {
        if (foundOriginalWords.size === originalWords.size && originalWords.size > 0) {
            celebratePuzzleCompletion();
        }
    }

    function celebratePuzzleCompletion() {
        // Stop the main timer
        if (autoRandomizeInterval) {
            clearInterval(autoRandomizeInterval);
        }
        
        // Calculate time taken
        const timeTaken = Date.now() - puzzleStartTime;
        const minutesTaken = Math.floor(timeTaken / 60000);
        const secondsTaken = Math.floor((timeTaken % 60000) / 1000);
        document.getElementById('time-taken').textContent = `${minutesTaken}:${secondsTaken.toString().padStart(2, '0')}`;
        
        // Show all found words
        const celebrationFoundWords = document.getElementById('celebration-found-words');
        celebrationFoundWords.innerHTML = '';
        foundOriginalWords.forEach(word => {
            const span = document.createElement('span');
            span.className = 'found';
            span.textContent = word;
            celebrationFoundWords.appendChild(span);
        });
        
        // Show bonus words
        document.getElementById('celebration-bonus-count').textContent = bonusWordsFound;
        const celebrationBonusWords = document.getElementById('celebration-bonus-words');
        celebrationBonusWords.innerHTML = '';
        bonusWordsArray.forEach(word => {
            const span = document.createElement('span');
            span.className = 'bonus';
            span.textContent = word;
            celebrationBonusWords.appendChild(span);
        });
        
        celebrationOverlay.classList.remove('hidden');
        
        let countdown = 10;
        countdownElement.textContent = countdown;
        
        const countdownInterval = setInterval(() => {
            countdown--;
            countdownElement.textContent = countdown;
            
            if (countdown <= 0) {
                clearInterval(countdownInterval);
                celebrationOverlay.classList.add('hidden');
                loadRandomPuzzle();
                // Restart the auto-randomize timer
                autoRandomizeInterval = setInterval(showSummaryScreen, 120000);
                startTimer();
            }
        }, 1000);
    }

    // --- Event Listeners ---

    wordInput.addEventListener('keyup', (event) => {
        if (event.key === 'Enter') {
            processGuess(wordInput.value);
        }
    });

    // --- Initial Kick-off ---
    setup();
});