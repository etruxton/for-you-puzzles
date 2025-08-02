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
    const celebrationEmojiGrid = document.getElementById('celebration-emoji-grid');
    const summaryEmojiGrid = document.getElementById('summary-emoji-grid');
    const copyCelebrationBtn = document.getElementById('copy-celebration-emoji');
    const copySummaryBtn = document.getElementById('copy-summary-emoji');
    
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
    let gameEmojiGrid = null;
    let puzzleCompletionTime = null;
    
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

    // Generate random username for display
    let playerUsername = localStorage.getItem('playerUsername');
    if (!playerUsername) {
        playerUsername = generateRandomUsername();
        localStorage.setItem('playerUsername', playerUsername);
    }

    // Notification system state
    let notificationSide = 'right'; // Track which side for alternating notifications

    // --- Username Generation ---
    function generateRandomUsername() {
        const adjectives = [
            'Swift', 'Clever', 'Bright', 'Quick', 'Sharp', 'Wise', 'Bold', 'Cool',
            'Epic', 'Wild', 'Calm', 'Pure', 'Fast', 'Smart', 'Rare', 'Free',
            'Dark', 'Soft', 'Deep', 'High', 'Rich', 'Warm', 'Cold', 'Loud',
            'Quiet', 'Strong', 'Light', 'Heavy', 'Smooth', 'Rough', 'Fresh', 'Sweet'
        ];
        
        const nouns = [
            'Wizard', 'Phoenix', 'Dragon', 'Tiger', 'Eagle', 'Wolf', 'Fox', 'Bear',
            'Hawk', 'Lion', 'Shark', 'Falcon', 'Raven', 'Lynx', 'Panther', 'Viper',
            'Storm', 'Flame', 'Shadow', 'Blade', 'Arrow', 'Star', 'Moon', 'Sun',
            'Ocean', 'Thunder', 'Lightning', 'Wind', 'Fire', 'Ice', 'Stone', 'Steel'
        ];
        
        const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
        const noun = nouns[Math.floor(Math.random() * nouns.length)];
        const number = Math.floor(Math.random() * 999) + 1;
        
        return `${adjective}${noun}${number}`;
    }

    // Generate consistent username based on player ID
    function generateUsernameFromPlayerId(playerId) {
        const adjectives = [
            'Swift', 'Clever', 'Bright', 'Quick', 'Sharp', 'Wise', 'Bold', 'Cool',
            'Epic', 'Wild', 'Calm', 'Pure', 'Fast', 'Smart', 'Rare', 'Free',
            'Dark', 'Soft', 'Deep', 'High', 'Rich', 'Warm', 'Cold', 'Loud',
            'Quiet', 'Strong', 'Light', 'Heavy', 'Smooth', 'Rough', 'Fresh', 'Sweet'
        ];
        
        const nouns = [
            'Wizard', 'Phoenix', 'Dragon', 'Tiger', 'Eagle', 'Wolf', 'Fox', 'Bear',
            'Hawk', 'Lion', 'Shark', 'Falcon', 'Raven', 'Lynx', 'Panther', 'Viper',
            'Storm', 'Flame', 'Shadow', 'Blade', 'Arrow', 'Star', 'Moon', 'Sun',
            'Ocean', 'Thunder', 'Lightning', 'Wind', 'Fire', 'Ice', 'Stone', 'Steel'
        ];
        
        // Generate hash from player ID for consistency
        let hash = 0;
        for (let i = 0; i < playerId.length; i++) {
            hash = playerId.charCodeAt(i) + ((hash << 5) - hash);
        }
        
        const adjIndex = Math.abs(hash) % adjectives.length;
        const nounIndex = Math.abs(hash >> 8) % nouns.length;
        const number = (Math.abs(hash >> 16) % 999) + 1;
        
        return `${adjectives[adjIndex]}${nouns[nounIndex]}${number}`;
    }

    // Cache for generated usernames
    const usernameCache = {};

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

    // --- Notification System ---
    function showWordFoundNotification(word, username, isCurrentPlayer = false, foundByPlayerId = null) {
        // Create notification element
        const notification = document.createElement('div');
        const wordsCounter = document.getElementById('words-counter');
        const puzzleInfo = document.getElementById('puzzle-info');
        
        // Alternate notification side
        const isRightSide = notificationSide === 'right';
        notificationSide = notificationSide === 'right' ? 'left' : 'right';
        
        if (wordsCounter && puzzleInfo) {
            const sideProperty = isRightSide ? 'right' : 'left';
            const animationName = isRightSide ? 'slideInFromRight' : 'slideInFromLeft';
            
            // Purple for base game, vs pink for TikTok extension
            const bgColor = 'linear-gradient(135deg, #6a4c93 0%, #9d4edd 100%)';
            
            notification.style.cssText = `
                position: absolute;
                top: 50%;
                transform: translateY(-50%);
                ${sideProperty}: 15px;
                background: ${bgColor};
                color: white;
                padding: 8px 12px;
                border-radius: 16px;
                font-size: 13px;
                font-weight: bold;
                z-index: 1000;
                box-shadow: 0 3px 8px rgba(0, 0, 0, 0.3);
                animation: ${animationName} 0.3s ease-out;
                max-width: 160px;
                text-align: center;
                font-family: Arial, sans-serif;
                pointer-events: none;
                user-select: none;
                backface-visibility: hidden;
                border: 2px solid rgba(255, 255, 255, 0.4);
            `;
            
            // Insert into the puzzle info container
            puzzleInfo.style.position = 'relative';
            puzzleInfo.appendChild(notification);
        } else {
            // Fallback positioning
            notification.style.cssText = `
                position: fixed;
                top: 20%;
                left: 50%;
                transform: translate(-50%, 0) translateZ(0);
                background: linear-gradient(135deg, #6a4c93 0%, #9d4edd 100%);
                color: white;
                padding: 12px 16px;
                border-radius: 12px;
                font-size: 16px;
                font-weight: bold;
                z-index: 10000;
                box-shadow: 0 6px 18px rgba(0, 0, 0, 0.4);
                animation: popIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                max-width: 250px;
                text-align: center;
                font-family: Arial, sans-serif;
                pointer-events: none;
                user-select: none;
                backface-visibility: hidden;
                border: 2px solid rgba(255, 255, 255, 0.3);
            `;
            
            document.body.appendChild(notification);
        }
        
        // Create avatar for the notification
        const avatarSize = '24px';
        const avatarPlayerId = foundByPlayerId || playerId;
        const avatarSvg = generateAvatar(avatarPlayerId);
        const avatarHtml = `<img src="${avatarSvg}" style="width: ${avatarSize}; height: ${avatarSize}; border-radius: 50%; margin-right: 8px; vertical-align: middle;">`;
        
        const displayName = isCurrentPlayer ? 'You' : username;
        
        notification.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center;">
                ${avatarHtml}
                <div>
                    <strong>${word}</strong><br>
                    <small>Found by ${displayName}</small>
                </div>
            </div>
        `;
        
        // Add animation keyframes if not already added
        if (!document.getElementById('base-game-animations')) {
            const style = document.createElement('style');
            style.id = 'base-game-animations';
            style.textContent = `
                @keyframes slideInFromRight {
                    0% { 
                        transform: translateX(100%) translateY(-50%) translateZ(0); 
                        opacity: 0; 
                    }
                    100% { 
                        transform: translateX(0) translateY(-50%) translateZ(0); 
                        opacity: 1; 
                    }
                }
                @keyframes slideOutToRight {
                    0% { 
                        transform: translateX(0) translateY(-50%) translateZ(0); 
                        opacity: 1; 
                    }
                    100% { 
                        transform: translateX(100%) translateY(-50%) translateZ(0); 
                        opacity: 0; 
                    }
                }
                @keyframes slideInFromLeft {
                    0% { 
                        transform: translateX(-100%) translateY(-50%) translateZ(0); 
                        opacity: 0; 
                    }
                    100% { 
                        transform: translateX(0) translateY(-50%) translateZ(0); 
                        opacity: 1; 
                    }
                }
                @keyframes slideOutToLeft {
                    0% { 
                        transform: translateX(0) translateY(-50%) translateZ(0); 
                        opacity: 1; 
                    }
                    100% { 
                        transform: translateX(-100%) translateY(-50%) translateZ(0); 
                        opacity: 0; 
                    }
                }
                @keyframes popIn {
                    0% { 
                        transform: translate(-50%, 0) scale(0.5) translateZ(0); 
                        opacity: 0; 
                    }
                    50% { 
                        transform: translate(-50%, 0) scale(1.1) translateZ(0); 
                    }
                    100% { 
                        transform: translate(-50%, 0) scale(1) translateZ(0); 
                        opacity: 1; 
                    }
                }
                @keyframes popOut {
                    0% { 
                        transform: translate(-50%, 0) scale(1) translateZ(0); 
                        opacity: 1; 
                    }
                    100% { 
                        transform: translate(-50%, 0) scale(0.8) translateZ(0); 
                        opacity: 0; 
                    }
                }
            `;
            document.head.appendChild(style);
        }
        
        // Remove after 3 seconds
        setTimeout(() => {
            if (wordsCounter && puzzleInfo && notification.parentNode === puzzleInfo) {
                const exitAnimation = isRightSide ? 'slideOutToRight' : 'slideOutToLeft';
                notification.style.animation = `${exitAnimation} 0.3s ease-in`;
            } else {
                notification.style.animation = 'popOut 0.3s ease-in';
            }
            
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
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
            if (gameData) {
                loadGameSession(gameData);
            }
        });
        
        socket.on('new_game', (gameData) => {
            console.log('New game started:', gameData);
            
            // Check if we're in the middle of a celebration or summary screen
            const celebrationVisible = !celebrationOverlay.classList.contains('hidden');
            const summaryVisible = !summaryOverlay.classList.contains('hidden');
            
            console.log('Celebration visible:', celebrationVisible, 'Summary visible:', summaryVisible);
            
            if (celebrationVisible || summaryVisible) {
                // Store the new game data to load after the countdown
                console.log('Storing game for later load after countdown');
                socket._pendingGame = gameData;
            } else {
                // Load immediately if no overlay is showing
                console.log('Loading game immediately');
                loadGameSession(gameData);
            }
        });
        
        socket.on('word_found', (data) => {
            if (data.success && currentSession) {
                updateFoundWordsList(data.foundWords);

                // Show notification for the word found
                if (data.word) {
                    const isCurrentPlayer = data.foundBy === playerId;
                    let username;
                    if (isCurrentPlayer) {
                        username = playerUsername;
                    } else {
                        // Generate consistent username for other players
                        if (!usernameCache[data.foundBy]) {
                            usernameCache[data.foundBy] = generateUsernameFromPlayerId(data.foundBy);
                        }
                        username = usernameCache[data.foundBy];
                    }
                    showWordFoundNotification(data.word, username, isCurrentPlayer, data.foundBy);
                }

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
            // Store the emoji grid
            if (data.emojiGrid) {
                gameEmojiGrid = data.emojiGrid;
            }
            // The celebration screen will show the reduced countdown automatically
        });
        
        socket.on('game_timeout', (data) => {
            console.log('Game timed out:', data.message);
            // Store the emoji grid and missed words
            if (data.emojiGrid) {
                gameEmojiGrid = data.emojiGrid;
            } else {
                gameEmojiGrid = null;
            }
            
            // Store missed words for the summary screen
            if (data.missedWords) {
                currentSession.missedWords = data.missedWords;
            }
            
            // Show the summary screen when game times out
            if (currentSession && currentSession.status === 'ACTIVE') {
                currentSession.status = 'EXPIRED';
                showSummaryScreen();
            }
        });
        
        // Listen for any socket event for debugging
        socket.onAny((eventName, ...args) => {
            console.log(`[DEBUG] Received event: ${eventName}`, args);
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
        originalWords = new Set(); // We no longer know the words in advance
        gridData = gameData.gridData;
        
        // Reset found words tracking
        allFoundWords.clear();
        foundOriginalWords.clear();
        bonusWordsFound = 0;
        bonusWordsArray = [];
        gameEmojiGrid = null;
        puzzleCompletionTime = null;
        
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
            li.dataset.foundBy = fw.foundBy;
            
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
                // Server will handle the timeout and emit 'game_timeout' event
            }
        };
        
        updateTimer();
        timerInterval = setInterval(updateTimer, 1000);
    }

    // --- UI Updates ---
    function updateWordsCounter() {
        foundCount.textContent = foundOriginalWords.size;
        totalCount.textContent = currentSession ? currentSession.totalWords : 0;
        bonusCount.textContent = bonusWordsFound;
    }

    function checkForCompletion() {
        // Completion is now handled by the server via socket events
        // The server will emit 'puzzle_completed' when all words are found
    }

    async function celebratePuzzleCompletion() {
        if (timerInterval) clearInterval(timerInterval);
        
        // Request current game state to get emoji grid
        try {
            const response = await fetch(`${SERVER_URL}/api/current-game`);
            const gameData = await response.json();
            if (gameData && gameData.emojiGrid) {
                gameEmojiGrid = gameData.emojiGrid;
            }
        } catch (error) {
            console.error('Error fetching emoji grid:', error);
        }

        // Calculate time taken
        const startTime = new Date(currentSession.startTime);
        const timeTaken = Date.now() - startTime.getTime();
        const minutesTaken = Math.floor(timeTaken / 60000);
        const secondsTaken = Math.floor((timeTaken % 60000) / 1000);
        const timeString = `${minutesTaken}:${secondsTaken.toString().padStart(2, '0')}`;
        
        // Store completion time for copy function
        puzzleCompletionTime = timeString;
        
        document.getElementById('time-taken').textContent = timeString;
        
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
        
        // Display emoji grid if available
        if (gameEmojiGrid && celebrationEmojiGrid) {
            celebrationEmojiGrid.textContent = gameEmojiGrid;
        } else if (celebrationEmojiGrid) {
            celebrationEmojiGrid.textContent = 'Grid not available';
        }
        
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
                } else {
                    // Poll for new game multiple times
                    console.log('[DEBUG] No pending game after celebration, starting poll for new game');
                    let pollAttempts = 0;
                    const pollInterval = setInterval(async () => {
                        pollAttempts++;
                        console.log(`[DEBUG] Polling for new game, attempt ${pollAttempts}`);
                        
                        try {
                            const response = await fetch(`${SERVER_URL}/api/current-game`);
                            const gameData = await response.json();
                            
                            if (gameData && gameData.status === 'ACTIVE') {
                                console.log('[DEBUG] New game found via polling!');
                                clearInterval(pollInterval);
                                loadGameSession(gameData);
                            } else if (pollAttempts >= 10) {
                                console.log('[DEBUG] Max poll attempts reached');
                                clearInterval(pollInterval);
                                showWaitingScreen();
                            }
                        } catch (error) {
                            console.error('Poll error:', error);
                        }
                    }, 500); // Poll every 500ms
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
        document.getElementById('summary-total').textContent = currentSession ? currentSession.totalWords : 0;
        document.getElementById('summary-bonus').textContent = bonusWordsFound;
        
        // Show missed words
        const missedWords = document.getElementById('missed-words');
        missedWords.innerHTML = '';
        if (currentSession && currentSession.missedWords) {
            currentSession.missedWords.forEach(word => {
                const span = document.createElement('span');
                span.className = 'missed';
                span.textContent = word;
                missedWords.appendChild(span);
            });
        }
        
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
        
        // Display emoji grid if available
        if (gameEmojiGrid && summaryEmojiGrid) {
            summaryEmojiGrid.textContent = gameEmojiGrid;
        } else if (summaryEmojiGrid) {
            summaryEmojiGrid.textContent = 'Grid not available';
        }
        
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
                } else {
                    // Poll for new game multiple times
                    console.log('[DEBUG] No pending game after celebration, starting poll for new game');
                    let pollAttempts = 0;
                    const pollInterval = setInterval(async () => {
                        pollAttempts++;
                        console.log(`[DEBUG] Polling for new game, attempt ${pollAttempts}`);
                        
                        try {
                            const response = await fetch(`${SERVER_URL}/api/current-game`);
                            const gameData = await response.json();
                            
                            if (gameData && gameData.status === 'ACTIVE') {
                                console.log('[DEBUG] New game found via polling!');
                                clearInterval(pollInterval);
                                loadGameSession(gameData);
                            } else if (pollAttempts >= 10) {
                                console.log('[DEBUG] Max poll attempts reached');
                                clearInterval(pollInterval);
                                showWaitingScreen();
                            }
                        } catch (error) {
                            console.error('Poll error:', error);
                        }
                    }, 500); // Poll every 500ms
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

    // --- Copy Button Functionality ---
    function setupCopyButton(button, getTextFunc) {
        if (!button) return; // Skip if button doesn't exist
        
        button.addEventListener('click', async () => {
            try {
                const textToCopy = getTextFunc();
                await navigator.clipboard.writeText(textToCopy);
                
                // Show success feedback
                button.classList.add('copied');
                const originalText = button.textContent;
                button.textContent = 'Copied!';
                
                setTimeout(() => {
                    button.classList.remove('copied');
                    button.textContent = originalText;
                }, 2000);
            } catch (err) {
                console.error('Failed to copy:', err);
            }
        });
    }
    
    // Setup copy buttons
    setupCopyButton(copyCelebrationBtn, () => {
        const category = currentSession ? currentSession.category : 'Word Search';
        const emojiGrid = gameEmojiGrid || 'No grid available';
        const timeText = puzzleCompletionTime ? `\nCompleted in: ${puzzleCompletionTime}` : '';
        return `For You Puzzles - ${category}${timeText}\n\n${emojiGrid}\n\nPlay at: ${window.location.origin}`;
    });
    
    setupCopyButton(copySummaryBtn, () => {
        const category = currentSession ? currentSession.category : 'Word Search';
        const emojiGrid = gameEmojiGrid || 'No grid available';
        // No completion time for summary (timeout case)
        return `For You Puzzles - ${category}\n\n${emojiGrid}\n\nPlay at: ${window.location.origin}`;
    });

    // --- Initialize ---
    connectSocket();
    setup();
});