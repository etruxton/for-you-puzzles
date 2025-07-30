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
    let gridData = [];
    let tileElements = [];
    let originalWords = new Set();
    let allFoundWords = new Set();
    let foundOriginalWords = new Set();
    let bonusWordsFound = 0;
    let bonusWordsArray = [];
    let timerInterval = null;
    let autoRandomizeInterval = null;
    let timeLeft = 120;
    let puzzleStartTime = null;
    
    const directions = [
        { x: 0, y: 1 }, { x: 0, y: -1 }, { x: 1, y: 0 }, { x: -1, y: 0 },
        { x: 1, y: 1 }, { x: -1, y: -1 }, { x: 1, y: -1 }, { x: -1, y: 1 }
    ];

    // --- AWS Amplify Configuration ---
    const Amplify = aws_amplify.default;
    
    const amplifyConfig = {
        aws_project_region: 'us-east-1', 
        aws_cognito_identity_pool_id: 'us-east-1:a181b53d-01ef-4749-bc82-dbb6b5ef62c4', 
        aws_appsync_graphqlEndpoint: 'https://gkxxys6qfbdnjih5rxaenjrulm.appsync-api.us-east-1.amazonaws.com/graphql',
        aws_appsync_region: 'us-east-1', 
        aws_appsync_authenticationType: 'AWS_IAM',
        Auth: {
            identityPoolId: 'us-east-1:a181b53d-01ef-4749-bc82-dbb6b5ef62c4',
            region: 'us-east-1'
        }
    };
    
    Amplify.configure(amplifyConfig);
    const { API } = Amplify;

    // --- GraphQL Queries ---
    const listPuzzlesQuery = /* GraphQL */ `
      query ListPuzzles {
        listPuzzles {
          puzzleId
          category
        }
      }
    `;

    const getPuzzleQuery = /* GraphQL */ `
      query GetPuzzle($puzzleId: ID!) {
        getPuzzle(puzzleId: $puzzleId) {
          puzzleId
          category
          originalWords
        }
      }
    `;

    // --- Puzzle Loading and Setup ---
    async function setup() {
        // Clear existing timers when loading a new puzzle
        if (timerInterval) clearInterval(timerInterval);
        if (autoRandomizeInterval) clearInterval(autoRandomizeInterval);

        try {
            // 1. Fetch the list of all available puzzles
            console.log("Fetching list of puzzles...");
            const allPuzzlesData = await API.graphql({ query: listPuzzlesQuery });
            const puzzlesList = allPuzzlesData.data.listPuzzles;

            if (!puzzlesList || puzzlesList.length === 0) {
                throw new Error("No puzzles found.");
            }

            // 2. Randomly select one puzzle from the list
            const randomPuzzle = puzzlesList[Math.floor(Math.random() * puzzlesList.length)];
            const puzzleIdToLoad = randomPuzzle.puzzleId;
            console.log(`Selected puzzle: ${puzzleIdToLoad}`);

            // 3. Fetch the full details for the selected puzzle
            const puzzleData = await API.graphql({
                query: getPuzzleQuery,
                variables: { puzzleId: puzzleIdToLoad }
            });
            const currentPuzzle = puzzleData.data.getPuzzle;

            // 4. Generate the puzzle grid and start the game
            if (currentPuzzle && currentPuzzle.originalWords) {
                puzzleTitle.textContent = currentPuzzle.category;
                generatePuzzleFromData(currentPuzzle.originalWords);
                startTimer();
                autoRandomizeInterval = setInterval(showSummaryScreen, 120000); 
            } else {
                throw new Error("Selected puzzle data is incomplete.");
            }

        } catch (error) {
            console.error('Failed to load and generate puzzle:', error);
            gridContainer.textContent = 'Error: Could not load a puzzle.';
        }
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
        
        while (attempts < maxAttempts) {
            grid = Array(gridSize).fill(null).map(() => Array(gridSize).fill(null));
            let allWordsPlaced = true;
            
            for (const word of inputWords) {
                let placed = false;
                const wordToPlace = Math.random() < 0.5 ? word : word.split('').reverse().join('');
                
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
        
        if (attempts === maxAttempts) {
            console.warn('Could not place all words after', maxAttempts, 'attempts');
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
        puzzleStartTime = Date.now();
    }

    function canPlaceWord(word, grid, row, col, dir) {
        const endRow = row + (word.length - 1) * dir.x;
        const endCol = col + (word.length - 1) * dir.y;
        if (endRow < 0 || endRow >= gridSize || endCol < 0 || endCol >= gridSize) return false;
        if (row < 0 || row >= gridSize || col < 0 || col >= gridSize) return false;
        
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
    
    // --- Rendering and Game Logic ---
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
        timeLeft = 120; // Reset time
        updateTimerDisplay(); // Display initial time immediately
        timerInterval = setInterval(() => {
            timeLeft--;
            updateTimerDisplay();
            
            if (timeLeft <= 0) {
                // This will be caught by the showSummaryScreen interval
                // but as a fallback, clear this timer.
                clearInterval(timerInterval);
            }
        }, 1000);
    }
    
    function showSummaryScreen() {
        // Stop the timers
        if (timerInterval) clearInterval(timerInterval);
        if (autoRandomizeInterval) clearInterval(autoRandomizeInterval);
        
        // Populate summary data
        document.getElementById('summary-found').textContent = foundOriginalWords.size;
        document.getElementById('summary-total').textContent = originalWords.size;
        document.getElementById('summary-bonus').textContent = bonusWordsFound;
        
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
        
        summaryOverlay.classList.remove('hidden');
        
        let countdown = 10;
        summaryCountdown.textContent = countdown;
        
        const countdownInterval = setInterval(() => {
            countdown--;
            summaryCountdown.textContent = countdown;
            
            if (countdown <= 0) {
                clearInterval(countdownInterval);
                summaryOverlay.classList.add('hidden');
                setup(); // Reloads a new random puzzle from AWS
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
        if (timerInterval) clearInterval(timerInterval);
        if (autoRandomizeInterval) clearInterval(autoRandomizeInterval);

        const timeTaken = Date.now() - puzzleStartTime;
        const minutesTaken = Math.floor(timeTaken / 60000);
        const secondsTaken = Math.floor((timeTaken % 60000) / 1000);
        document.getElementById('time-taken').textContent = `${minutesTaken}:${secondsTaken.toString().padStart(2, '0')}`;
        
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
        
        celebrationOverlay.classList.remove('hidden');
        
        let countdown = 10;
        countdownElement.textContent = countdown;
        
        const countdownInterval = setInterval(() => {
            countdown--;
            countdownElement.textContent = countdown;
            
            if (countdown <= 0) {
                clearInterval(countdownInterval);
                celebrationOverlay.classList.add('hidden');
                setup(); // Reloads a new random puzzle from AWS
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