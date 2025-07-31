document.addEventListener('DOMContentLoaded', () => {
    // --- Configuration ---
    const SERVER_URL = window.location.origin; // Automatically uses the same origin
    
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
    let gridData = [];
    let tileElements = [];
    let currentSession = null;
    let originalWords = new Set();
    let allFoundWords = new Set();
    let foundOriginalWords = new Set();
    let bonusWordsFound = 0;
    let bonusWordsArray = [];
    let timerInterval = null;
    let socket = null;
    
    const directions = [
        { x: 0, y: 1 }, { x: 0, y: -1 }, { x: 1, y: 0 }, { x: -1, y: 0 },
        { x: 1, y: 1 }, { x: -1, y: -1 }, { x: 1, y: -1 }, { x: -1, y: 1 }
    ];

    // Generate or retrieve player ID
    let playerId = localStorage.getItem('playerId');
    if (!playerId) {
        playerId = 'player-' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('playerId', playerId);
    }

    // --- Socket.IO Connection ---
    function connectSocket() {
        socket = io(SERVER_URL);
        
        socket.on('connect', () => {
            console.log('Connected to server');
        });
        
        socket.on('current_game', (gameData) => {
            if (gameData) {
                loadGameSession(gameData);
            }
        });
        
        socket.on('new_game', (gameData) => {
            console.log('New game started:', gameData.sessionId, gameData.puzzleId);
            
            // Check if we're in the middle of a celebration or summary screen
            const celebrationVisible = !celebrationOverlay.classList.contains('hidden');
            const summaryVisible = !summaryOverlay.classList.contains('hidden');
            
            if (celebrationVisible || summaryVisible) {
                // Store the new game data to load after the countdown
                socket._pendingGame = gameData;
            } else {
                // Load immediately if no overlay is showing
                loadGameSession(gameData);
            }
        });
        
        socket.on('word_found', (data) => {
            if (data.success && currentSession) {
                updateFoundWordsList(data.foundWords);
            }
        });
        
        socket.on('puzzle_completed', (data) => {
            console.log('Puzzle completed:', data.message);
            // The celebration screen will show the reduced countdown automatically
        });
        
        socket.on('disconnect', () => {
            console.log('Disconnected from server');
        });
    }

    // --- Game Setup ---
    async function setup() {
        try {
            const response = await fetch(`${SERVER_URL}/api/current-game`);
            const gameData = await response.json();
            
            if (gameData && gameData.status === 'ACTIVE') {
                loadGameSession(gameData);
            } else {
                showWaitingScreen();
            }
        } catch (error) {
            console.error('Failed to load game:', error);
            gridContainer.textContent = 'Error: Could not connect to server';
        }
    }

    function loadGameSession(gameData) {
        currentSession = gameData;
        originalWords = new Set(gameData.words);
        gridData = gameData.gridData;
        
        // Reset found words tracking
        allFoundWords.clear();
        foundOriginalWords.clear();
        bonusWordsFound = 0;
        bonusWordsArray = [];
        
        // Process already found words
        if (gameData.foundWords) {
            gameData.foundWords.forEach(fw => {
                allFoundWords.add(fw.word);
                if (!fw.isBonus) {
                    foundOriginalWords.add(fw.word);
                } else {
                    bonusWordsFound++;
                    bonusWordsArray.push(fw.word);
                }
            });
        }
        
        // Update UI
        puzzleTitle.textContent = gameData.category;
        renderGrid(gridData);
        updateWordsCounter();
        displayFoundWords(gameData.foundWords || []);
        
        // Start timer
        startTimer(new Date(gameData.endTime));
    }

    function showWaitingScreen() {
        gridContainer.innerHTML = '<p style="text-align: center; color: #bb86fc;">Waiting for next game to start...</p>';
        puzzleTitle.textContent = 'Loading...';
    }

    // --- Rendering ---
    function renderGrid(grid) {
        gridContainer.innerHTML = '';
        tileElements = [];
        
        for (let r = 0; r < gridSize; r++) {
            const rowElements = [];
            for (let c = 0; c < gridSize; c++) {
                const letter = grid[r][c];
                const tile = document.createElement('div');
                tile.className = 'grid-tile';
                tile.textContent = letter;
                gridContainer.appendChild(tile);
                rowElements.push(tile);
            }
            tileElements.push(rowElements);
        }
    }

    function moveWordToTop(word) {
        // Find the word in either list
        const foundWordItem = foundWordsList.querySelector(`li[data-word="${word}"]`);
        const bonusWordItem = bonusWordsList.querySelector(`li[data-word="${word}"]`);
        
        if (foundWordItem) {
            foundWordsList.prepend(foundWordItem);
        } else if (bonusWordItem) {
            bonusWordsList.prepend(bonusWordItem);
        }
    }

    function displayFoundWords(foundWords) {
        foundWordsList.innerHTML = '';
        bonusWordsList.innerHTML = '';
        
        foundWords.forEach(fw => {
            const li = document.createElement('li');
            li.textContent = fw.word;
            li.title = `Found by ${fw.foundBy}`;
            li.dataset.word = fw.word;  // Add data attribute for easy selection
            
            if (fw.isBonus) {
                bonusWordsList.appendChild(li);
            } else {
                foundWordsList.appendChild(li);
            }
        });
    }

    function updateFoundWordsList(foundWords) {
        // Clear and rebuild the lists
        allFoundWords.clear();
        foundOriginalWords.clear();
        bonusWordsFound = 0;
        bonusWordsArray = [];
        
        foundWords.forEach(fw => {
            allFoundWords.add(fw.word);
            if (!fw.isBonus) {
                foundOriginalWords.add(fw.word);
            } else {
                bonusWordsFound++;
                bonusWordsArray.push(fw.word);
            }
        });
        
        displayFoundWords(foundWords);
        updateWordsCounter();
        checkForCompletion();
    }

    // --- Word Processing ---
    async function processGuess(word) {
        word = word.toUpperCase().trim();
        if (word.length < 3 || !currentSession) return;

        const path = findWordOnGrid(word);
        if (!path) return;

        // Check if already found locally
        if (allFoundWords.has(word)) {
            highlightPath(path);
            moveWordToTop(word);  // Move the word to the top
            wordInput.value = '';
            return;
        }

        // Verify it's a real word
        const isValid = await isRealWord(word);
        if (!isValid) return;

        // Submit to server
        try {
            const response = await fetch(`${SERVER_URL}/api/submit-word`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: currentSession.sessionId,
                    word: word,
                    playerId: playerId
                })
            });

            const result = await response.json();
            
            if (result.success || result.alreadyFound) {
                highlightPath(path);
                wordInput.value = '';
            }
        } catch (error) {
            console.error('Error submitting word:', error);
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
            
            if (newR < 0 || newR >= gridSize || newC < 0 || newC >= gridSize || 
                gridData[newR][newC] !== word[k]) {
                return null;
            }
            path.push({ x: newR, y: newC });
        }
        return path;
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

    // --- Timer Management ---
    function startTimer(endTime) {
        if (timerInterval) clearInterval(timerInterval);
        
        const updateTimer = () => {
            const now = new Date();
            const timeLeft = Math.max(0, Math.floor((endTime - now) / 1000));
            
            const minutes = Math.floor(timeLeft / 60);
            const seconds = timeLeft % 60;
            timeRemaining.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
            
            if (timeLeft <= 0) {
                clearInterval(timerInterval);
                showSummaryScreen();
            }
        };
        
        updateTimer();
        timerInterval = setInterval(updateTimer, 1000);
    }

    // --- UI Updates ---
    function updateWordsCounter() {
        foundCount.textContent = foundOriginalWords.size;
        totalCount.textContent = originalWords.size;
        bonusCount.textContent = bonusWordsFound;
    }

    function checkForCompletion() {
        if (foundOriginalWords.size === originalWords.size && originalWords.size > 0) {
            celebratePuzzleCompletion();
        }
    }

    function celebratePuzzleCompletion() {
        if (timerInterval) clearInterval(timerInterval);

        // Calculate time taken
        const startTime = new Date(currentSession.startTime);
        const timeTaken = Date.now() - startTime.getTime();
        const minutesTaken = Math.floor(timeTaken / 60000);
        const secondsTaken = Math.floor((timeTaken % 60000) / 1000);
        document.getElementById('time-taken').textContent = 
            `${minutesTaken}:${secondsTaken.toString().padStart(2, '0')}`;
        
        // Show found words
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
        
        // FIXED: Always use 10 seconds for early completion
        let countdown = 10;
        countdownElement.textContent = countdown;
        
        const countdownInterval = setInterval(() => {
            countdown--;
            countdownElement.textContent = countdown;
            
            if (countdown <= 0) {
                clearInterval(countdownInterval);
                celebrationOverlay.classList.add('hidden');
                
                // Load pending game if there is one
                if (socket._pendingGame) {
                    loadGameSession(socket._pendingGame);
                    socket._pendingGame = null;
                }
            }
        }, 1000);
    }

    function showSummaryScreen() {
        if (!currentSession) return;
        
        // Stop the timer
        if (timerInterval) clearInterval(timerInterval);
        
        // Populate summary
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
        
        summaryOverlay.classList.remove('hidden');
        
        // Countdown to next game
        let countdown = 10;
        summaryCountdown.textContent = countdown;
        
        const countdownInterval = setInterval(() => {
            countdown--;
            summaryCountdown.textContent = countdown;
            
            if (countdown <= 0) {
                clearInterval(countdownInterval);
                summaryOverlay.classList.add('hidden');
                
                // Load pending game if there is one
                if (socket._pendingGame) {
                    loadGameSession(socket._pendingGame);
                    socket._pendingGame = null;
                }
            }
        }, 1000);
    }

    // --- Event Listeners ---
    wordInput.addEventListener('keyup', (event) => {
        if (event.key === 'Enter') {
            processGuess(wordInput.value);
        }
    });

    // --- Initialize ---
    connectSocket();
    setup();
});