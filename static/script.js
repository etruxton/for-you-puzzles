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

    // --- Avatar Generation ---
    function generateAvatar(playerId) {
        // Use player ID to generate consistent values
        let hash = 0;
        for (let i = 0; i < playerId.length; i++) {
            hash = playerId.charCodeAt(i) + ((hash << 5) - hash);
        }
        
        // Generate colors from hash
        const hue = Math.abs(hash) % 360;
        const backgroundColor = `hsl(${hue}, 70%, 80%)`;
        const accentColor = `hsl(${(hue + 180) % 360}, 60%, 50%)`;
        
        // Pick avatar style based on hash
        const styleIndex = Math.abs(hash) % 8;
        
        let svg = '';
        
        switch(styleIndex) {
            case 0: // Robot
                svg = `
                    <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="12" cy="12" r="12" fill="${backgroundColor}"/>
                        <rect x="7" y="7" width="10" height="10" rx="2" fill="#C0C0C0"/>
                        <rect x="5" y="10" width="3" height="1" fill="#808080"/>
                        <rect x="16" y="10" width="3" height="1" fill="#808080"/>
                        <circle cx="9" cy="10" r="1.5" fill="${accentColor}"/>
                        <circle cx="15" cy="10" r="1.5" fill="${accentColor}"/>
                        <rect x="9" y="13" width="6" height="1" fill="#666"/>
                    </svg>
                `;
                break;
            
            case 1: // Cat
                svg = `
                    <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="12" cy="12" r="12" fill="${backgroundColor}"/>
                        <ellipse cx="12" cy="13" rx="7" ry="6" fill="${accentColor}"/>
                        <path d="M5 7 L7 13 L9 9 Z" fill="${accentColor}"/>
                        <path d="M19 7 L17 13 L15 9 Z" fill="${accentColor}"/>
                        <circle cx="9" cy="12" r="1" fill="#000"/>
                        <circle cx="15" cy="12" r="1" fill="#000"/>
                        <path d="M12 14 L11 15 L12 16 L13 15 Z" fill="#FFB6C1"/>
                        <path d="M6 13 Q9 13, 9 15" fill="none" stroke="#000" stroke-width="0.5"/>
                        <path d="M18 13 Q15 13, 15 15" fill="none" stroke="#000" stroke-width="0.5"/>
                    </svg>
                `;
                break;
            
            case 2: // Alien
                svg = `
                    <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="12" cy="12" r="12" fill="${backgroundColor}"/>
                        <ellipse cx="12" cy="11" rx="6" ry="8" fill="#90EE90"/>
                        <circle cx="9" cy="10" r="2" fill="#000"/>
                        <circle cx="15" cy="10" r="2" fill="#000"/>
                        <circle cx="9" cy="10" r="0.5" fill="#FFF"/>
                        <circle cx="15" cy="10" r="0.5" fill="#FFF"/>
                        <ellipse cx="12" cy="15" rx="1" ry="2" fill="#444"/>
                        <circle cx="6" cy="6" r="1" fill="${accentColor}"/>
                        <circle cx="18" cy="6" r="1" fill="${accentColor}"/>
                        <line x1="6" y1="6" x2="8" y2="8" stroke="${accentColor}" stroke-width="0.5"/>
                        <line x1="18" y1="6" x2="16" y2="8" stroke="${accentColor}" stroke-width="0.5"/>
                    </svg>
                `;
                break;
            
            case 3: // Monster
                svg = `
                    <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="12" cy="12" r="12" fill="${backgroundColor}"/>
                        <circle cx="12" cy="12" r="8" fill="${accentColor}"/>
                        <circle cx="12" cy="9" r="3" fill="#FFF"/>
                        <circle cx="12" cy="9" r="2" fill="#000"/>
                        <path d="M8 15 Q10 13, 12 15 Q14 13, 16 15" fill="#FFF"/>
                        <path d="M8 4 L9 7 L10 4" fill="${accentColor}"/>
                        <path d="M12 4 L12 7" fill="${accentColor}"/>
                        <path d="M14 4 L15 7 L16 4" fill="${accentColor}"/>
                    </svg>
                `;
                break;
            
            case 4: // Bear
                svg = `
                    <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="12" cy="12" r="12" fill="${backgroundColor}"/>
                        <circle cx="8" cy="8" r="3" fill="#8B4513"/>
                        <circle cx="16" cy="8" r="3" fill="#8B4513"/>
                        <circle cx="12" cy="13" r="7" fill="#8B4513"/>
                        <circle cx="9" cy="12" r="1" fill="#000"/>
                        <circle cx="15" cy="12" r="1" fill="#000"/>
                        <ellipse cx="12" cy="15" rx="2" ry="1.5" fill="#000"/>
                        <circle cx="8" cy="8" r="1.5" fill="#D2691E"/>
                        <circle cx="16" cy="8" r="1.5" fill="#D2691E"/>
                    </svg>
                `;
                break;
            
            case 5: // Ghost
                svg = `
                    <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="12" cy="12" r="12" fill="${backgroundColor}"/>
                        <path d="M12 5 Q6 5, 6 12 L6 17 Q7 16, 8 17 Q9 16, 10 17 Q11 16, 12 17 Q13 16, 14 17 Q15 16, 16 17 Q17 16, 18 17 L18 12 Q18 5, 12 5" fill="#FFF"/>
                        <circle cx="9" cy="10" r="1.5" fill="#000"/>
                        <circle cx="15" cy="10" r="1.5" fill="#000"/>
                        <ellipse cx="12" cy="13" rx="1" ry="2" fill="#000" opacity="0.3"/>
                    </svg>
                `;
                break;
            
            case 6: // Octopus
                svg = `
                    <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="12" cy="12" r="12" fill="${backgroundColor}"/>
                        <ellipse cx="12" cy="10" rx="6" ry="7" fill="${accentColor}"/>
                        <circle cx="9" cy="9" r="1.5" fill="#FFF"/>
                        <circle cx="15" cy="9" r="1.5" fill="#FFF"/>
                        <circle cx="9" cy="9" r="0.8" fill="#000"/>
                        <circle cx="15" cy="9" r="0.8" fill="#000"/>
                        <path d="M8 15 Q8 18, 7 19 Q8 18, 8 15" fill="${accentColor}"/>
                        <path d="M10 15 Q10 18, 9 19 Q10 18, 10 15" fill="${accentColor}"/>
                        <path d="M12 15 Q12 18, 11 19 Q12 18, 12 15" fill="${accentColor}"/>
                        <path d="M14 15 Q14 18, 13 19 Q14 18, 14 15" fill="${accentColor}"/>
                        <path d="M16 15 Q16 18, 17 19 Q16 18, 16 15" fill="${accentColor}"/>
                    </svg>
                `;
                break;
            
            case 7: // Wizard
                svg = `
                    <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="12" cy="12" r="12" fill="${backgroundColor}"/>
                        <path d="M12 4 L7 12 L17 12 Z" fill="${accentColor}"/>
                        <circle cx="12" cy="7" r="1" fill="#FFD700"/>
                        <circle cx="12" cy="14" r="5" fill="#FFE4C4"/>
                        <circle cx="10" cy="13" r="0.8" fill="#000"/>
                        <circle cx="14" cy="13" r="0.8" fill="#000"/>
                        <path d="M7 17 Q12 22, 17 17" fill="#FFF" opacity="0.8"/>
                        <path d="M10 16 Q12 17, 14 16" fill="none" stroke="#000" stroke-width="0.5"/>
                    </svg>
                `;
                break;
        }
        
        return 'data:image/svg+xml;base64,' + btoa(svg);
    }
    
    // Cache for avatars
    const avatarCache = {};
    
    function getAvatar(playerId) {
        if (!avatarCache[playerId]) {
            avatarCache[playerId] = generateAvatar(playerId);
        }
        return avatarCache[playerId];
    }

    // Extract background color for a player
    function getPlayerBackgroundColor(playerId) {
        let hash = 0;
        for (let i = 0; i < playerId.length; i++) {
            hash = playerId.charCodeAt(i) + ((hash << 5) - hash);
        }
        
        const hue = Math.abs(hash) % 360;
        return `hsl(${hue}, 70%, 80%)`;
    }

    // --- Socket.IO Connection ---
    function connectSocket() {
        // Use relative path for Socket.IO to work on both local and Heroku
        const socketUrl = window.location.hostname === 'localhost' 
            ? 'http://localhost:5000' 
            : window.location.origin;
            
        socket = io(socketUrl, {
            transports: ['websocket', 'polling'], // Try websocket first, fallback to polling
            upgrade: true
        });
        
        socket.on('connect', () => {
            console.log('Connected to server');
            // Request current game state when connected
            socket.emit('request_current_game');
        });
        
        socket.on('current_game', (gameData) => {
            console.log('Received current game:', gameData);
            if (gameData && gameData.status === 'ACTIVE') {
                // Clear waiting timer if it exists
                if (waitingTimer) {
                    clearInterval(waitingTimer);
                    waitingTimer = null;
                }
                
                // Clear any polling intervals that might be running
                clearAllPollingIntervals();
                
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
            } else if (!gameData) {
                // No active game, show waiting screen
                showWaitingScreen();
            }
        });
        
        socket.on('game_pending', (data) => {
            console.log('Game pending:', data.message);
            showWaitingScreen(data.countdown);
            if (data.category) {
                puzzleTitle.textContent = `Next: ${data.category}`;
            }
        });
        
        
        socket.on('new_game', (gameData) => {
            console.log('New game started:', gameData);
            
            // Clear waiting timer if it exists
            if (waitingTimer) {
                clearInterval(waitingTimer);
                waitingTimer = null;
            }
            
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
                
                // Highlight the word on the grid if someone else found it
                if (data.foundBy && data.foundBy !== playerId && data.word) {
                    const path = findWordOnGrid(data.word);
                    if (path) {
                        highlightPath(path, data.foundBy); // Pass the player ID who found it
                    }
                }
            }
        });
        
        socket.on('puzzle_completed', (data) => {
            console.log('Puzzle completed:', data.message);
            // The celebration screen will show the reduced countdown automatically
        });
        
        socket.on('connect_error', (error) => {
            console.error('Connection error:', error.message);
            gridContainer.innerHTML = '<p style="text-align: center; color: #ff6b6b;">Connection error. Please refresh the page.</p>';
        });
        
        socket.on('disconnect', () => {
            console.log('Disconnected from server');
            gridContainer.innerHTML = '<p style="text-align: center; color: #ff6b6b;">Disconnected. Attempting to reconnect...</p>';
        });
    }

    // --- Game Setup ---
    function setup() {
        // Show waiting screen initially - Socket.IO will handle loading the actual game
        showWaitingScreen();
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
        
        // Start timer with proper date parsing
        const endTime = new Date(gameData.endTime);
        console.log('Game ends at:', endTime.toLocaleString());
        startTimer(endTime);
    }

    let waitingTimer = null;
    let pollingIntervals = []; // Track all polling intervals
    
    function clearAllPollingIntervals() {
        pollingIntervals.forEach(interval => {
            if (interval) {
                clearInterval(interval);
            }
        });
        pollingIntervals = [];
    }
    
    function showWaitingScreen(countdown = null) {
        // Clear any existing waiting timer
        if (waitingTimer) {
            clearInterval(waitingTimer);
            waitingTimer = null;
        }
        
        if (countdown && countdown > 0) {
            // Show countdown timer
            const minutes = Math.floor(countdown / 60);
            const seconds = countdown % 60;
            const timeText = `${minutes}:${seconds.toString().padStart(2, '0')}`;
            
            gridContainer.innerHTML = `
                <div style="text-align: center; color: #bb86fc;">
                    <p>Waiting for next game to start... try refreshing browser.</p>
                    <p style="font-size: 24px; font-weight: bold; color: #03dac6; margin-top: 10px;">${timeText}</p>
                </div>
            `;
            
            // Start countdown timer
            waitingTimer = setInterval(() => {
                countdown--;
                if (countdown <= 0) {
                    clearInterval(waitingTimer);
                    waitingTimer = null;
                    gridContainer.innerHTML = '<p style="text-align: center; color: #bb86fc;">Game starting...</p>';
                    // Request current game state in case we missed the new_game event
                    socket.emit('request_current_game');
                } else {
                    const minutes = Math.floor(countdown / 60);
                    const seconds = countdown % 60;
                    const timeText = `${minutes}:${seconds.toString().padStart(2, '0')}`;
                    const timerElement = gridContainer.querySelector('p:nth-child(2)');
                    if (timerElement) {
                        timerElement.textContent = timeText;
                    }
                }
            }, 1000);
        } else {
            // No countdown, just show waiting message
            gridContainer.innerHTML = '<p style="text-align: center; color: #bb86fc;">Waiting for next game to start...</p>';
        }
        
        puzzleTitle.textContent = 'Loading...';
        foundWordsList.innerHTML = '';
        bonusWordsList.innerHTML = '';
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
            
            // Create avatar img
            const avatar = document.createElement('img');
            avatar.src = getAvatar(fw.foundBy);
            avatar.className = 'player-avatar';
            avatar.title = fw.foundBy === playerId ? 'You' : fw.foundBy;
            
            // Create word span
            const wordSpan = document.createElement('span');
            wordSpan.textContent = fw.word;
            
            // Add both to li
            li.appendChild(avatar);
            li.appendChild(wordSpan);
            li.dataset.word = fw.word;
            li.dataset.foundBy = fw.foundBy; // Store who found it
            
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
            // Find who originally found this word
            const foundWordItem = foundWordsList.querySelector(`li[data-word="${word}"]`) || 
                                 bonusWordsList.querySelector(`li[data-word="${word}"]`);
            const originalFinder = foundWordItem ? foundWordItem.dataset.foundBy : playerId;
            
            highlightPath(path, originalFinder);
            moveWordToTop(word); 	// Move the word to the top
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
                highlightPath(path, playerId); // Highlight with your own color
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

    function highlightPath(path, foundByPlayerId = null) {
        const actualPlayerId = foundByPlayerId || playerId;
        const playerColor = getPlayerBackgroundColor(actualPlayerId);
        
        path.forEach(pos => {
            const tile = tileElements[pos.x][pos.y];
            
            // Remove any existing highlight classes first
            tile.classList.remove('highlighted', 'highlighted-other');
            
            // Force reflow to reset animation
            void tile.offsetWidth;
            
            // Apply custom background color
            tile.style.backgroundColor = playerColor;
            tile.style.color = '#000000';
            tile.classList.add('highlighted-custom');
        });
        
        setTimeout(() => {
            path.forEach(pos => {
                const tile = tileElements[pos.x][pos.y];
                tile.classList.remove('highlighted-custom');
                tile.style.backgroundColor = '';
                tile.style.color = '';
            });
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
            const end = new Date(endTime);
            const timeLeft = Math.max(0, Math.floor((end - now) / 1000));
            
            const minutes = Math.floor(timeLeft / 60);
            const seconds = timeLeft % 60;
            timeRemaining.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
            
            if (timeLeft <= 0 && currentSession && currentSession.status === 'ACTIVE') {
                clearInterval(timerInterval);
                currentSession.status = 'EXPIRED'; // Prevent multiple triggers
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
        
        // Load pending game immediately but disable input
        if (socket._pendingGame) {
            loadGameSession(socket._pendingGame);
            socket._pendingGame = null;
        }
        
        // Disable word input during celebration
        wordInput.disabled = true;
        
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
                
                // Re-enable word input
                wordInput.disabled = false;
                wordInput.focus();
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
        
        // Load pending game immediately but disable input
        if (socket._pendingGame) {
            loadGameSession(socket._pendingGame);
            socket._pendingGame = null;
        }
        
        // Disable word input during summary
        wordInput.disabled = true;
        
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
                
                // Re-enable word input
                wordInput.disabled = false;
                wordInput.focus();
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