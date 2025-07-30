document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const gridContainer = document.getElementById('grid-container');
    const wordInput = document.getElementById('word-input');
    const puzzleTitle = document.getElementById('puzzle-title');
    const foundCount = document.getElementById('found-count');
    const totalCount = document.getElementById('total-count');
    const foundWordsList = document.getElementById('found-words-list');
    const bonusWordsList = document.getElementById('bonus-words-list');
    const bonusCount = document.getElementById('bonus-count');
    
    // --- Game State ---
    const gridSize = 10;
    let tileElements = [];
    let currentPuzzle = null; // Will hold the entire puzzle state from the backend

    // AWS Amplify v3 exposes as aws_amplify
    if (typeof aws_amplify === 'undefined') {
        console.error('AWS Amplify library not found. Please check that it loaded correctly.');
        console.log('Available globals:', Object.keys(window).filter(k => k.includes('aws') || k.includes('amplify') || k.includes('Amplify')));
        gridContainer.innerHTML = '<p style="color: red;">Error: AWS Amplify not loaded. Please refresh the page.</p>';
        return;
    }
    
    // Extract Amplify from aws_amplify
    const Amplify = aws_amplify.default || aws_amplify;
    
    const amplifyConfig = {
        aws_project_region: 'us-east-1', 
        aws_cognito_identity_pool_id: 'us-east-1:a181b53d-01ef-4749-bc82-dbb6b5ef62c4', 
        aws_appsync_graphqlEndpoint: 'https://7x2l4jhm3bcqvkuifm3522udfi.appsync-api.us-east-1.amazonaws.com/graphql',
        aws_appsync_region: 'us-east-1', 
        aws_appsync_authenticationType: 'AWS_IAM',
        Auth: {
            identityPoolId: 'us-east-1:a181b53d-01ef-4749-bc82-dbb6b5ef62c4',
            region: 'us-east-1'
        }
    };
    
    Amplify.configure(amplifyConfig);
    const { API } = Amplify;

    const getPuzzleQuery = /* GraphQL */ `
      query GetPuzzle($puzzleId: ID!) {
        getPuzzle(puzzleId: $puzzleId) {
          puzzleId
          category
          originalWords
          grid
          foundWords {
            word
            foundBy
            pfp
          }
        }
      }
    `;

    const updatePuzzleMutation = /* GraphQL */ `
      mutation UpdatePuzzle($puzzleId: ID!, $foundWords: [FoundWordInput]) {
        updatePuzzle(puzzleId: $puzzleId, foundWords: $foundWords) {
          puzzleId
          foundWords {
            word
          }
        }
      }
    `;

    const onUpdatePuzzleSubscription = /* GraphQL */ `
      subscription OnUpdatePuzzle($puzzleId: ID!) {
        onUpdatePuzzle(puzzleId: $puzzleId) {
          puzzleId
          category
          originalWords
          grid
          foundWords {
            word
            foundBy
            pfp
          }
        }
      }
    `;

    // =================================================================
    // MAIN SETUP FUNCTION
    // =================================================================
    async function setup() {
        const puzzleIdToLoad = "MUSIC_THEORY"; // You can change this to dynamically load different puzzles

        try {
            // 1. Fetch the initial state of the puzzle
            const puzzleData = await API.graphql({
                query: getPuzzleQuery,
                variables: { puzzleId: puzzleIdToLoad }
            });
            currentPuzzle = puzzleData.data.getPuzzle;
            if (currentPuzzle) {
                renderUIFromPuzzleState(currentPuzzle);
            }

            // 2. Subscribe to real-time updates for this puzzle
            API.graphql({
                query: onUpdatePuzzleSubscription,
                variables: { puzzleId: puzzleIdToLoad }
            }).subscribe({
                next: ({ value }) => {
                    // When an update is received, update the current state and re-render the UI
                    currentPuzzle = value.data.onUpdatePuzzle;
                    if (currentPuzzle) {
                        renderUIFromPuzzleState(currentPuzzle);
                    }
                },
                error: (error) => console.warn(error)
            });

        } catch (error) {
            console.error("Error setting up puzzle:", error);
            gridContainer.innerHTML = `<p>Could not load puzzle. Check console for details.</p>`;
        }
    }

    // --- Renders the entire UI based on the current puzzle state ---
    function renderUIFromPuzzleState(puzzle) {
        // Render the grid if it exists
        if (puzzle.grid) {
            renderGrid(puzzle.grid);
        }

        // Update titles and counters
        puzzleTitle.textContent = puzzle.category || 'Word Search';
        totalCount.textContent = puzzle.originalWords?.length || 0;
        
        // Clear and render word lists
        foundWordsList.innerHTML = '';
        bonusWordsList.innerHTML = '';

        const foundOriginal = [];
        const foundBonus = [];

        puzzle.foundWords?.forEach(foundWord => {
            if (puzzle.originalWords.includes(foundWord.word)) {
                foundOriginal.push(foundWord);
            } else {
                foundBonus.push(foundWord);
            }
        });

        foundCount.textContent = foundOriginal.length;
        bonusCount.textContent = foundBonus.length;

        foundOriginal.forEach(word => addWordToList(word, foundWordsList));
        foundBonus.forEach(word => addWordToList(word, bonusWordsList));
    }
    
    function renderGrid(gridString) {
        gridContainer.innerHTML = '';
        tileElements = [];
        for (let r = 0; r < gridSize; r++) {
            const rowElements = [];
            for (let c = 0; c < gridSize; c++) {
                const letter = gridString[r * gridSize + c];
                const tile = document.createElement('div');
                tile.className = 'grid-tile';
                tile.textContent = letter;
                gridContainer.appendChild(tile);
                rowElements.push(tile);
            }
            tileElements.push(rowElements);
        }
    }
    
    function addWordToList(wordData, listElement) {
        const li = document.createElement('li');
        // You can add logic here to display the PFP if you want
        li.textContent = wordData.word;
        li.dataset.word = wordData.word;
        listElement.prepend(li);
    }
    
    // --- Word Finding and Highlighting (Local Logic) ---
    function findWordOnGrid(word) {
        // This function remains the same as before, searching the local gridData
        // (For brevity, not including the full function again)
        const grid2D = [];
        for (let i = 0; i < gridSize; i++) {
            grid2D.push(currentPuzzle.grid.substring(i * gridSize, (i + 1) * gridSize).split(''));
        }

        const wordReversed = word.split('').reverse().join('');
        for (let r = 0; r < gridSize; r++) {
            for (let c = 0; c < gridSize; c++) {
                for (const dir of [{ x: 0, y: 1 }, { x: 0, y: -1 }, { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 1, y: 1 }, { x: -1, y: -1 }, { x: 1, y: -1 }, { x: -1, y: 1 }]) {
                    let path = checkDirection(word, r, c, dir, grid2D);
                    if (path) return path;
                    path = checkDirection(wordReversed, r, c, dir, grid2D);
                    if (path) return path;
                }
            }
        }
        return null;
    }

    function checkDirection(word, r, c, dir, grid2D) {
        const path = [];
        for (let k = 0; k < word.length; k++) {
            const newR = r + k * dir.x;
            const newC = c + k * dir.y;
            if (newR < 0 || newR >= gridSize || newC < 0 || newC >= gridSize || grid2D[newR][newC] !== word[k]) {
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

    // --- Main Guess Handling ---
    async function processGuess(word) {
        word = word.toUpperCase().trim();
        if (!currentPuzzle || word.length < 3) return;

        // Check if word is already found
        const alreadyFound = currentPuzzle.foundWords?.some(fw => fw.word === word);
        
        const path = findWordOnGrid(word);
        if (!path) return;

        if (alreadyFound) {
            highlightPath(path);
            wordInput.value = '';
            return;
        }
        
        // This is a new word, let's validate and update
        const isWordValid = await isRealWord(word);
        if (!isWordValid) return;

        // Optimistically highlight the path for immediate feedback
        highlightPath(path);
        wordInput.value = '';

        // Construct the new state and send the mutation
        const newFoundWord = { word, foundBy: "WebAppUser", pfp: "avatar.png" };
        const updatedFoundWords = [...(currentPuzzle.foundWords || []), newFoundWord];

        try {
            await API.graphql({
                query: updatePuzzleMutation,
                variables: {
                    puzzleId: currentPuzzle.puzzleId,
                    foundWords: updatedFoundWords.map(({ __typename, ...rest }) => rest) // Remove __typename if it exists
                }
            });
            // The subscription will handle the UI update
        } catch (error) {
            console.error("Error updating puzzle:", error);
        }
    }

    async function isRealWord(word) {
        try {
            const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
            return response.ok;
        } catch (error) {
            console.error("Dictionary API error:", error);
            return false;
        }
    }

    // --- Event Listener ---
    wordInput.addEventListener('keyup', (event) => {
        if (event.key === 'Enter') {
            processGuess(wordInput.value);
        }
    });

    // --- Initial Kick-off ---
    setup();
});