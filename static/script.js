document.addEventListener('DOMContentLoaded', () => {
    const SERVER_URL = window.location.origin;

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

    let bloomFilter = null;
    let bloomBits = 0;
    let bloomHashes = 0;
    fetch('/dictionary.bin')
        .then(r => r.arrayBuffer())
        .then(buf => {
            const view = new DataView(buf);
            bloomBits = view.getUint32(0, true);
            bloomHashes = view.getUint32(4, true);
            bloomFilter = new Uint8Array(buf, 12);
        });

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
        if (!bloomFilter) return true;
        const h1 = fnv1a(word);
        const h2 = djb2(word);
        for (let i = 0; i < bloomHashes; i++) {
            const bit = ((h1 + Math.imul(i, h2)) >>> 0) % bloomBits;
            if (!(bloomFilter[bit >> 3] & (1 << (bit & 7)))) return false;
        }
        return true;
    }

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

    let playerId = localStorage.getItem('playerId');
    if (!playerId) {
        playerId = 'player-' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('playerId', playerId);
    }

    let playerUsername = localStorage.getItem('playerUsername');
    let notificationSide = 'right';

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

        let hash = 0;
        for (let i = 0; i < playerId.length; i++) {
            hash = playerId.charCodeAt(i) + ((hash << 5) - hash);
        }

        const adjIndex = Math.abs(hash) % adjectives.length;
        const nounIndex = Math.abs(hash >> 8) % nouns.length;
        const number = (Math.abs(hash >> 16) % 999) + 1;

        return `${adjectives[adjIndex]}${nouns[nounIndex]}${number}`;
    }

    const usernameCache = {};

    if (!playerUsername) {
        playerUsername = generateUsernameFromPlayerId(playerId);
        localStorage.setItem('playerUsername', playerUsername);
    }

    function generateAvatar(playerId) {
        let hash = 0;
        for (let i = 0; i < playerId.length; i++) {
            hash = playerId.charCodeAt(i) + ((hash << 5) - hash);
        }

        const hue = Math.abs(hash) % 360;
        const backgroundColor = `hsl(${hue}, 70%, 80%)`;
        const accentColor = `hsl(${(hue + 180) % 360}, 60%, 50%)`;
        const styleIndex = Math.abs(hash) % 8;

        let svg = '';

        switch(styleIndex) {
            case 0:
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
            case 1:
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
            case 2:
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
            case 3:
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
            case 4:
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
            case 5:
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
            case 6:
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
            case 7:
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

    const avatarCache = {};

    function getAvatar(playerId) {
        if (!avatarCache[playerId]) {
            avatarCache[playerId] = generateAvatar(playerId);
        }
        return avatarCache[playerId];
    }

    function getPlayerBackgroundColor(playerId) {
        let hash = 0;
        for (let i = 0; i < playerId.length; i++) {
            hash = playerId.charCodeAt(i) + ((hash << 5) - hash);
        }

        const hue = Math.abs(hash) % 360;
        return `hsl(${hue}, 70%, 80%)`;
    }

    function showWordFoundNotification(word, username, isCurrentPlayer = false, foundByPlayerId = null) {
        const notification = document.createElement('div');
        const wordsCounter = document.getElementById('words-counter');
        const puzzleInfo = document.getElementById('puzzle-info');

        const isRightSide = notificationSide === 'right';
        notificationSide = notificationSide === 'right' ? 'left' : 'right';

        if (wordsCounter && puzzleInfo) {
            const sideProperty = isRightSide ? 'right' : 'left';
            const animationName = isRightSide ? 'slideInFromRight' : 'slideInFromLeft';
            const bgColor = 'linear-gradient(135deg, #6a4c93 0%, #9d4edd 100%)';

            notification.style.cssText = `
                position: absolute;
                top: 50%;
                transform: translateY(-50%);
                ${sideProperty}: 15px;
                background: ${bgColor};
                color: white;
                padding: ${window.innerWidth < 480 ? '6px 8px' : '8px 12px'};
                margin: 10px;
                border-radius: 15px;
                font-size: ${window.innerWidth < 480 ? '11px' : '13px'};
                font-weight: bold;
                z-index: 1000;
                box-shadow: 0 3px 8px rgba(0, 0, 0, 0.3);
                animation: ${animationName} 0.3s ease-out;
                max-width: ${window.innerWidth < 480 ? '120px' : '150px'};
                text-align: center;
                font-family: Arial, sans-serif;
                pointer-events: none;
                user-select: none;
                backface-visibility: hidden;
                border: 2px solid rgba(255, 255, 255, 0.4);
            `;

            puzzleInfo.style.position = 'relative';
            puzzleInfo.appendChild(notification);
        } else {
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

        const avatarSize = window.innerWidth < 480 ? '20px' : '24px';
        const avatarPlayerId = foundByPlayerId || playerId;
        const avatarSvg = generateAvatar(avatarPlayerId);
        const displayName = isCurrentPlayer ? playerUsername : username;

        const notifContainer = document.createElement('div');
        notifContainer.style.cssText = 'display:flex;align-items:center;justify-content:center;';
        const avatarImg = document.createElement('img');
        avatarImg.src = avatarSvg;
        avatarImg.style.cssText = `width:${avatarSize};height:${avatarSize};border-radius:50%;margin-right:8px;`;
        const textDiv = document.createElement('div');
        const strong = document.createElement('strong');
        strong.textContent = word;
        const small = document.createElement('small');
        small.textContent = 'Found by ' + displayName;
        textDiv.appendChild(strong);
        textDiv.appendChild(document.createElement('br'));
        textDiv.appendChild(small);
        notifContainer.appendChild(avatarImg);
        notifContainer.appendChild(textDiv);
        notification.appendChild(notifContainer);

        if (!document.getElementById('base-game-animations')) {
            const style = document.createElement('style');
            style.id = 'base-game-animations';
            style.textContent = `
                @keyframes slideInFromRight {
                    0% { transform: translateX(100%) translateY(-50%) translateZ(0); opacity: 0; }
                    100% { transform: translateX(0) translateY(-50%) translateZ(0); opacity: 1; }
                }
                @keyframes slideOutToRight {
                    0% { transform: translateX(0) translateY(-50%) translateZ(0); opacity: 1; }
                    100% { transform: translateX(100%) translateY(-50%) translateZ(0); opacity: 0; }
                }
                @keyframes slideInFromLeft {
                    0% { transform: translateX(-100%) translateY(-50%) translateZ(0); opacity: 0; }
                    100% { transform: translateX(0) translateY(-50%) translateZ(0); opacity: 1; }
                }
                @keyframes slideOutToLeft {
                    0% { transform: translateX(0) translateY(-50%) translateZ(0); opacity: 1; }
                    100% { transform: translateX(-100%) translateY(-50%) translateZ(0); opacity: 0; }
                }
                @keyframes popIn {
                    0% { transform: translate(-50%, 0) scale(0.5) translateZ(0); opacity: 0; }
                    50% { transform: translate(-50%, 0) scale(1.1) translateZ(0); }
                    100% { transform: translate(-50%, 0) scale(1) translateZ(0); opacity: 1; }
                }
                @keyframes popOut {
                    0% { transform: translate(-50%, 0) scale(1) translateZ(0); opacity: 1; }
                    100% { transform: translate(-50%, 0) scale(0.8) translateZ(0); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }

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

    let pendingGame = null;
    let reconnectDelay = 1000;

    function connectSocket() {
        const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${wsProto}//${window.location.host}/api/ws`;

        socket = new WebSocket(wsUrl);

        socket.addEventListener('open', () => {
            reconnectDelay = 1000;
            socket.send(JSON.stringify({ type: 'request_current_game' }));
        });

        socket.addEventListener('message', (event) => {
            const msg = JSON.parse(event.data);

            if (msg.type === 'current_game') {
                if (msg.data) loadGameSession(msg.data);
            }

            else if (msg.type === 'new_game') {
                const celebrationVisible = !celebrationOverlay.classList.contains('hidden');
                const summaryVisible = !summaryOverlay.classList.contains('hidden');
                if (celebrationVisible || summaryVisible) {
                    pendingGame = msg.data;
                } else {
                    loadGameSession(msg.data);
                }
            }

            else if (msg.type === 'word_found') {
                const data = msg.data;
                if (data.success && currentSession) {
                    updateFoundWordsList(data.foundWords);
                    if (data.word) {
                        const isCurrentPlayer = data.foundBy === playerId;
                        let username;
                        if (isCurrentPlayer) {
                            username = playerUsername;
                        } else {
                            if (!usernameCache[data.foundBy]) {
                                usernameCache[data.foundBy] = generateUsernameFromPlayerId(data.foundBy);
                            }
                            username = usernameCache[data.foundBy];
                        }
                        showWordFoundNotification(data.word, username, isCurrentPlayer, data.foundBy);
                    }
                    if (data.foundBy && data.foundBy !== playerId && data.word) {
                        const path = findWordOnGrid(data.word);
                        if (path) highlightPath(path, data.foundBy);
                    }
                }
            }

            else if (msg.type === 'puzzle_completed') {
                if (msg.data.emojiGrid) gameEmojiGrid = msg.data.emojiGrid;
                celebratePuzzleCompletion();
            }

            else if (msg.type === 'game_timeout') {
                if (msg.data.emojiGrid) gameEmojiGrid = msg.data.emojiGrid;
                else gameEmojiGrid = null;
                if (msg.data.missedWords && currentSession) currentSession.missedWords = msg.data.missedWords;
                if (currentSession && currentSession.status === 'ACTIVE') {
                    currentSession.status = 'EXPIRED';
                    showSummaryScreen();
                }
            }
        });

        socket.addEventListener('close', () => {
            gridContainer.innerHTML = '<p style="text-align: center; color: #ff6b6b;">Disconnected. Reconnecting...</p>';
            setTimeout(connectSocket, reconnectDelay);
            reconnectDelay = Math.min(reconnectDelay * 2, 30000);
        });
    }

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
        originalWords = new Set();
        gridData = gameData.gridData;

        allFoundWords.clear();
        foundOriginalWords.clear();
        bonusWordsFound = 0;
        bonusWordsArray = [];
        gameEmojiGrid = null;
        puzzleCompletionTime = null;

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

        puzzleTitle.textContent = gameData.category;
        renderGrid(gridData);
        updateWordsCounter();
        displayFoundWords(gameData.foundWords || []);

        const endTime = new Date(gameData.endTime);
        startTimer(endTime);
    }

    function showWaitingScreen() {
        gridContainer.innerHTML = '<p style="text-align: center; color: #bb86fc;">Waiting for next game to start...</p>';
        puzzleTitle.textContent = 'Loading...';
    }

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

    function findListItemByWord(list, word) {
        for (const li of list.children) {
            if (li.dataset.word === word) return li;
        }
        return null;
    }

    function moveWordToTop(word) {
        const foundWordItem = findListItemByWord(foundWordsList, word);
        const bonusWordItem = findListItemByWord(bonusWordsList, word);
        if (foundWordItem) foundWordsList.prepend(foundWordItem);
        else if (bonusWordItem) bonusWordsList.prepend(bonusWordItem);
    }

    function displayFoundWords(foundWords) {
        foundWordsList.innerHTML = '';
        bonusWordsList.innerHTML = '';

        foundWords.forEach(fw => {
            const li = document.createElement('li');
            const avatar = document.createElement('img');
            avatar.src = getAvatar(fw.foundBy);
            avatar.title = fw.foundBy === playerId ? 'You' : fw.foundBy;
            avatar.className = 'player-avatar';

            const wordSpan = document.createElement('span');
            wordSpan.textContent = fw.word;

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
    }

    function shakeInput() {
        wordInput.classList.remove('invalid');
        void wordInput.offsetWidth;
        wordInput.classList.add('invalid');
        setTimeout(() => wordInput.classList.remove('invalid'), 400);
    }

    function processGuess(word) {
        word = word.toUpperCase().trim();
        if (word.length < 3 || !currentSession) return;

        if (!isWord(word)) {
            shakeInput();
            return;
        }

        const path = findWordOnGrid(word);
        if (!path) {
            shakeInput();
            return;
        }

        wordInput.value = '';

        if (allFoundWords.has(word)) {
            const foundWordItem = findListItemByWord(foundWordsList, word) || findListItemByWord(bonusWordsList, word);
            const originalFinder = foundWordItem ? foundWordItem.dataset.foundBy : playerId;
            highlightPath(path, originalFinder);
            moveWordToTop(word);
            return;
        }

        highlightPath(path, playerId);
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'submit_word', data: { word, playerId } }));
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
            }
        };

        updateTimer();
        timerInterval = setInterval(updateTimer, 1000);
    }

    function updateWordsCounter() {
        foundCount.textContent = foundOriginalWords.size;
        totalCount.textContent = currentSession ? currentSession.totalWords : 0;
        bonusCount.textContent = bonusWordsFound;
    }

    function checkForCompletion() {
        // Handled by the server via 'puzzle_completed' WebSocket event
    }

    async function celebratePuzzleCompletion() {
        if (timerInterval) clearInterval(timerInterval);

        try {
            const response = await fetch(`${SERVER_URL}/api/current-game`);
            const gameData = await response.json();
            if (gameData && gameData.emojiGrid) {
                gameEmojiGrid = gameData.emojiGrid;
            }
        } catch (error) {
            console.error('Error fetching emoji grid:', error);
        }

        const startTime = new Date(currentSession.startTime);
        const timeTaken = Date.now() - startTime.getTime();
        const minutesTaken = Math.floor(timeTaken / 60000);
        const secondsTaken = Math.floor((timeTaken % 60000) / 1000);
        const timeString = `${minutesTaken}:${secondsTaken.toString().padStart(2, '0')}`;

        puzzleCompletionTime = timeString;
        document.getElementById('time-taken').textContent = timeString;

        const celebrationFoundWords = document.getElementById('celebration-found-words');
        celebrationFoundWords.innerHTML = '';
        foundOriginalWords.forEach(word => {
            const span = document.createElement('span');
            span.className = 'found';
            span.textContent = word;
            celebrationFoundWords.appendChild(span);
        });

        document.getElementById('celebration-bonus-count').textContent = bonusWordsFound;
        const celebrationBonusWords = document.getElementById('celebration-bonus-words');
        celebrationBonusWords.innerHTML = '';
        bonusWordsArray.forEach(word => {
            const span = document.createElement('span');
            span.className = 'bonus';
            span.textContent = word;
            celebrationBonusWords.appendChild(span);
        });

        if (gameEmojiGrid && celebrationEmojiGrid) {
            celebrationEmojiGrid.textContent = gameEmojiGrid;
        } else if (celebrationEmojiGrid) {
            celebrationEmojiGrid.textContent = 'Grid not available';
        }

        celebrationOverlay.classList.remove('hidden');

        let countdown = 10;
        countdownElement.textContent = countdown;

        const countdownInterval = setInterval(() => {
            countdown--;
            countdownElement.textContent = countdown;

            if (countdown <= 0) {
                clearInterval(countdownInterval);
                celebrationOverlay.classList.add('hidden');
                loadPendingOrPoll();
            }
        }, 1000);
    }

    function showSummaryScreen() {
        if (!currentSession) return;
        if (timerInterval) clearInterval(timerInterval);

        document.getElementById('summary-found').textContent = foundOriginalWords.size;
        document.getElementById('summary-total').textContent = currentSession ? currentSession.totalWords : 0;
        document.getElementById('summary-bonus').textContent = bonusWordsFound;

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

        const foundWordsSummary = document.getElementById('found-words-summary');
        foundWordsSummary.innerHTML = '';
        foundOriginalWords.forEach(word => {
            const span = document.createElement('span');
            span.className = 'found';
            span.textContent = word;
            foundWordsSummary.appendChild(span);
        });

        const bonusWordsSummary = document.getElementById('bonus-words-summary');
        bonusWordsSummary.innerHTML = '';
        bonusWordsArray.forEach(word => {
            const span = document.createElement('span');
            span.className = 'bonus';
            span.textContent = word;
            bonusWordsSummary.appendChild(span);
        });

        if (gameEmojiGrid && summaryEmojiGrid) {
            summaryEmojiGrid.textContent = gameEmojiGrid;
        } else if (summaryEmojiGrid) {
            summaryEmojiGrid.textContent = 'Grid not available';
        }

        summaryOverlay.classList.remove('hidden');

        let countdown = 10;
        summaryCountdown.textContent = countdown;

        const countdownInterval = setInterval(() => {
            countdown--;
            summaryCountdown.textContent = countdown;

            if (countdown <= 0) {
                clearInterval(countdownInterval);
                summaryOverlay.classList.add('hidden');
                loadPendingOrPoll();
            }
        }, 1000);
    }

    function loadPendingOrPoll() {
        if (pendingGame) {
            loadGameSession(pendingGame);
            pendingGame = null;
        } else {
            let pollAttempts = 0;
            const pollInterval = setInterval(async () => {
                pollAttempts++;
                try {
                    const response = await fetch(`${SERVER_URL}/api/current-game`);
                    const gameData = await response.json();

                    if (gameData && gameData.status === 'ACTIVE') {
                        clearInterval(pollInterval);
                        loadGameSession(gameData);
                    } else if (pollAttempts >= 10) {
                        clearInterval(pollInterval);
                        showWaitingScreen();
                    }
                } catch (error) {
                    console.error('Poll error:', error);
                }
            }, 500);
        }
    }

    wordInput.addEventListener('keyup', (event) => {
        if (event.key === 'Enter') {
            processGuess(wordInput.value);
        }
    });

    wordInput.focus();

    if (window.visualViewport && window.matchMedia('(max-width: 768px)').matches) {
        let lastHeight = window.visualViewport.height;
        window.visualViewport.addEventListener('resize', () => {
            const vv = window.visualViewport;
            if (vv.height < lastHeight) {
                gridContainer.scrollIntoView({ block: 'start', behavior: 'instant' });
            }
            lastHeight = vv.height;
        });
    }

    function setupCopyButton(button, getTextFunc) {
        if (!button) return;

        button.addEventListener('click', async () => {
            try {
                const textToCopy = getTextFunc();
                await navigator.clipboard.writeText(textToCopy);

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

    setupCopyButton(copyCelebrationBtn, () => {
        const category = currentSession ? currentSession.category : 'Word Search';
        const emojiGrid = gameEmojiGrid || 'No grid available';
        const timeText = puzzleCompletionTime ? `\nCompleted in: ${puzzleCompletionTime}` : '';
        return `word.erica.rocks - ${category}${timeText}\n\n${emojiGrid}\n\nPlay at: ${window.location.origin}`;
    });

    setupCopyButton(copySummaryBtn, () => {
        const category = currentSession ? currentSession.category : 'Word Search';
        const emojiGrid = gameEmojiGrid || 'No grid available';
        return `word.erica.rocks - ${category}\n\n${emojiGrid}\n\nPlay at: ${window.location.origin}`;
    });

    connectSocket();
    setup();
});
