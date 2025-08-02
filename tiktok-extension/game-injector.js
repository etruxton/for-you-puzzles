// Content script for the word search game - injects TikTok functionality

class GameInjector {
  constructor() {
    this.gameDetected = false;
    this.socket = null;
    this.playerId = null;
    
    // Wait for the game to load
    this.waitForGame();
    
    // Listen for messages from the background script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true;
    });
  }
  
  async waitForGame() {
    // Check if we're on the correct page
    if (!this.isGamePage()) {
      return;
    }
    
    // Wait for game elements to load
    const maxAttempts = 50;
    let attempts = 0;
    
    const checkGame = () => {
      attempts++;
      
      if (this.detectGame()) {
        this.initializeGameIntegration();
        return;
      }
      
      if (attempts < maxAttempts) {
        setTimeout(checkGame, 200);
      } else {
        console.log('TikTok Bridge: Could not detect game after 10 seconds');
      }
    };
    
    checkGame();
  }
  
  isGamePage() {
    // Check if we're on localhost or the game domain
    return window.location.hostname === 'localhost' || 
           window.location.hostname === '127.0.0.1' ||
           document.title.includes('For You Puzzles');
  }
  
  detectGame() {
    // Look for game-specific elements
    const gameElements = [
      '#grid-container',
      '#word-input',
      '#puzzle-title',
      '.grid-tile'
    ];
    
    return gameElements.some(selector => document.querySelector(selector));
  }
  
  async initializeGameIntegration() {
    console.log('TikTok Bridge: Game detected, initializing integration');
    this.gameDetected = true;
    
    // Get player ID from localStorage (same as the game does)
    this.playerId = localStorage.getItem('playerId');
    if (!this.playerId) {
      this.playerId = 'player-' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('playerId', this.playerId);
    }
    
    // Add TikTok status indicator to the game
    this.addTikTokStatusIndicator();
    
    // Notify background script that game is ready
    try {
      await chrome.runtime.sendMessage({ type: 'GAME_TAB_READY' });
    } catch (error) {
      console.error('Failed to notify background script:', error);
    }
    
    console.log('TikTok Bridge: Game integration initialized');
  }
  
  addTikTokStatusIndicator() {
    // Check if indicator already exists
    if (document.getElementById('tiktok-bridge-status')) {
      return;
    }
    
    // Create status indicator
    const statusDiv = document.createElement('div');
    statusDiv.id = 'tiktok-bridge-status';
    statusDiv.innerHTML = `
      <div style="
        position: fixed;
        top: 10px;
        right: 10px;
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 8px 12px;
        border-radius: 20px;
        font-size: 12px;
        z-index: 9999;
        display: flex;
        align-items: center;
        gap: 6px;
        font-family: Arial, sans-serif;
        pointer-events: none;
        user-select: none;
        transform: translateZ(0);
        will-change: auto;
        backface-visibility: hidden;
      ">
        <span id="tiktok-bridge-indicator" style="
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #ff4444;
          pointer-events: none;
        "></span>
        <span id="tiktok-bridge-text" style="pointer-events: none;">TikTok Bridge: Inactive</span>
      </div>
    `;
    
    document.body.appendChild(statusDiv);
  }
  
  updateTikTokStatus(connected, username = '') {
    const indicator = document.getElementById('tiktok-bridge-indicator');
    const text = document.getElementById('tiktok-bridge-text');
    
    if (indicator && text) {
      if (connected) {
        indicator.style.background = '#44ff44';
        text.textContent = `TikTok Bridge: Connected${username ? ` (@${username})` : ''}`;
      } else {
        indicator.style.background = '#ff4444';
        text.textContent = 'TikTok Bridge: Inactive';
      }
    }
  }
  
  async handleMessage(message, sender, sendResponse) {
    try {
      switch (message.type) {
        case 'SUBMIT_WORD':
          const result = await this.submitWord(message.word, message.user);
          sendResponse(result);
          break;
          
        case 'GET_GAME_STATUS':
          sendResponse({
            gameDetected: this.gameDetected,
            playerId: this.playerId,
            url: window.location.href
          });
          break;
          
        default:
          sendResponse({ error: 'Unknown message type' });
      }
    } catch (error) {
      console.error('Game injector error:', error);
      sendResponse({ error: error.message });
    }
  }
  
  async submitWord(word, user) {
    if (!this.gameDetected) {
      throw new Error('Game not detected');
    }
    
    try {
      // First check if the word exists in the grid by trying to find it
      const wordExists = await this.checkWordInGrid(word);
      if (!wordExists) {
        return {
          success: false,
          word: word,
          reason: 'Word not found in grid'
        };
      }
      
      // Show visual feedback regardless of API response (since we know word exists)
      this.showWordFoundNotification(word, user);
      this.flashStatusIndicator(true);
      
      // Try to submit to API (but don't rely on its success for highlighting)
      try {
        const gameData = await this.getCurrentGameData();
        if (gameData && gameData.sessionId) {
          // Always use the same base player ID to keep avatar consistent
          const basePlayerId = user.isTest ? 
            `test_${user.username}` : 
            `tiktok_${user.username}`;
          
          // Always submit with the same player ID - the API might reject duplicates, but that's OK
          // We handle highlighting separately anyway
          await fetch('/api/submit-word', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              sessionId: gameData.sessionId,
              word: word,
              playerId: basePlayerId
            })
          });
        }
      } catch (apiError) {
        console.log('API submission failed, but continuing with highlighting:', apiError);
      }
      
      // Always highlight if word exists in grid
      this.highlightWordOnGrid(word, user);
      
      console.log(`TikTok Bridge: Word "${word}" found by ${user.username}!`);
      
      return {
        success: true,
        word: word,
        user: user.username
      };
      
    } catch (error) {
      console.error('Failed to submit word:', error);
      throw error;
    }
  }
  
  async getCurrentGameData() {
    try {
      const response = await fetch('/api/current-game');
      if (!response.ok) {
        throw new Error('Failed to get game data');
      }
      return await response.json();
    } catch (error) {
      console.error('Failed to get current game:', error);
      return null;
    }
  }
  
  async checkWordInGrid(word) {
    try {
      // Get current game data to access the grid
      const gameData = await this.getCurrentGameData();
      if (!gameData || !gameData.gridData) {
        return false;
      }
      
      const grid = gameData.gridData;
      const wordUpper = word.toUpperCase();
      const gridSize = grid.length;
      
      // All possible directions
      const directions = [
        [0, 1], [0, -1], [1, 0], [-1, 0],
        [1, 1], [-1, -1], [1, -1], [-1, 1]
      ];
      
      // Check all positions and directions
      for (let row = 0; row < gridSize; row++) {
        for (let col = 0; col < gridSize; col++) {
          for (const [dr, dc] of directions) {
            if (this.checkWordAtPosition(grid, wordUpper, row, col, dr, dc)) {
              return true;
            }
          }
        }
      }
      
      return false;
    } catch (error) {
      console.error('Error checking word in grid:', error);
      return false;
    }
  }
  
  checkWordAtPosition(grid, word, startRow, startCol, deltaRow, deltaCol) {
    const gridSize = grid.length;
    
    for (let i = 0; i < word.length; i++) {
      const row = startRow + i * deltaRow;
      const col = startCol + i * deltaCol;
      
      // Check bounds
      if (row < 0 || row >= gridSize || col < 0 || col >= gridSize) {
        return false;
      }
      
      // Check letter match
      if (grid[row][col] !== word[i]) {
        return false;
      }
    }
    
    return true;
  }
  
  async highlightWordOnGrid(word, user) {
    try {
      // Find the word's position in the grid
      const wordPath = await this.findWordPath(word);
      
      if (wordPath && wordPath.length > 0) {
        // Create a visual highlight effect
        this.createHighlightEffect(wordPath, user);
      }
    } catch (error) {
      console.error('Error highlighting word:', error);
    }
  }
  
  async findWordPath(word) {
    try {
      const gameData = await this.getCurrentGameData();
      if (!gameData || !gameData.gridData) {
        return null;
      }
      
      const grid = gameData.gridData;
      const wordUpper = word.toUpperCase();
      const gridSize = grid.length;
      
      const directions = [
        [0, 1], [0, -1], [1, 0], [-1, 0],
        [1, 1], [-1, -1], [1, -1], [-1, 1]
      ];
      
      // Find the word and return its path
      for (let row = 0; row < gridSize; row++) {
        for (let col = 0; col < gridSize; col++) {
          for (const [dr, dc] of directions) {
            if (this.checkWordAtPosition(grid, wordUpper, row, col, dr, dc)) {
              // Build the path
              const path = [];
              for (let i = 0; i < wordUpper.length; i++) {
                path.push({
                  row: row + i * dr,
                  col: col + i * dc
                });
              }
              return path;
            }
          }
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error finding word path:', error);
      return null;
    }
  }
  
  createHighlightEffect(path, user) {
    try {
      // Find grid tiles
      const gridContainer = document.getElementById('grid-container');
      if (!gridContainer) return;
      
      const tiles = gridContainer.querySelectorAll('.grid-tile');
      if (tiles.length === 0) return;
      
      const gridSize = Math.sqrt(tiles.length);
      
      // Generate color based on the base player ID (without timestamp)
      // This should match exactly what the game uses for avatar generation
      const basePlayerId = user.isTest ? 
        `test_${user.username}` : 
        `tiktok_${user.username}`;
      
      const highlightColor = this.getPlayerBackgroundColor(basePlayerId);
      
      // Highlight each tile in the path
      path.forEach(({ row, col }) => {
        const tileIndex = row * gridSize + col;
        const tile = tiles[tileIndex];
        
        if (tile) {
          // Simple highlight - just background color
          tile.style.backgroundColor = highlightColor;
          tile.classList.add('tiktok-highlight');
          
          // Remove highlight after 1.5 seconds
          setTimeout(() => {
            tile.style.backgroundColor = '';
            tile.classList.remove('tiktok-highlight');
          }, 1500);
        }
      });
      
    } catch (error) {
      console.error('Error creating highlight effect:', error);
    }
  }
  
  getPlayerBackgroundColor(playerId) {
    // Generate consistent color based on player ID (exact same logic as original game)
    let hash = 0;
    for (let i = 0; i < playerId.length; i++) {
      hash = playerId.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 70%, 80%)`;
  }
  
  showWordFoundNotification(word, user) {
    // Create notification element
    const notification = document.createElement('div');
    // Find the puzzle title element to position relative to it
    const puzzleTitle = document.getElementById('puzzle-title');
    const puzzleInfo = document.getElementById('puzzle-info');
    
    if (puzzleTitle && puzzleInfo) {
      // Position relative to puzzle title
      const rect = puzzleTitle.getBoundingClientRect();
      const infoRect = puzzleInfo.getBoundingClientRect();
      
      notification.style.cssText = `
        position: absolute;
        top: ${rect.top - infoRect.top + window.scrollY + 5}px;
        right: 20px;
        background: linear-gradient(135deg, #ff0050 0%, #ff4d8f 100%);
        color: white;
        padding: 8px 12px;
        border-radius: 20px;
        font-size: 14px;
        font-weight: bold;
        z-index: 1000;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        animation: slideInFromRight 0.3s ease-out;
        max-width: 180px;
        text-align: center;
        font-family: Arial, sans-serif;
        pointer-events: none;
        user-select: none;
        backface-visibility: hidden;
        border: 2px solid rgba(255, 255, 255, 0.4);
      `;
      
      // Insert into the puzzle info container instead of body
      puzzleInfo.style.position = 'relative';
      puzzleInfo.appendChild(notification);
    } else {
      // Fallback to original center positioning if elements not found
      notification.style.cssText = `
        position: fixed;
        top: 20%;
        left: 50%;
        transform: translate(-50%, 0) translateZ(0);
        background: linear-gradient(135deg, #ff0050 0%, #ff4d8f 100%);
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
    
    const icon = user.isTest ? '🧪' : '🎵';
    notification.innerHTML = `
      ${icon} <strong>${word}</strong><br>
      <small>Found by ${user.username}</small>
    `;
    
    // Add animation keyframes if not already added
    if (!document.getElementById('tiktok-bridge-animations')) {
      const style = document.createElement('style');
      style.id = 'tiktok-bridge-animations';
      style.textContent = `
        @keyframes slideInFromRight {
          0% { 
            transform: translateX(100%) translateZ(0); 
            opacity: 0; 
          }
          100% { 
            transform: translateX(0) translateZ(0); 
            opacity: 1; 
          }
        }
        @keyframes slideOutToRight {
          0% { 
            transform: translateX(0) translateZ(0); 
            opacity: 1; 
          }
          100% { 
            transform: translateX(100%) translateZ(0); 
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
    
    // Don't append here - it's done in the if/else above
    
    // Remove after 3 seconds
    setTimeout(() => {
      if (puzzleTitle && puzzleInfo && notification.parentNode === puzzleInfo) {
        notification.style.animation = 'slideOutToRight 0.3s ease-in';
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
  
  flashStatusIndicator(success) {
    const indicator = document.getElementById('tiktok-bridge-indicator');
    if (!indicator) return;
    
    const originalColor = indicator.style.background;
    const flashColor = success ? '#00ff00' : '#ff8800';
    
    indicator.style.background = flashColor;
    indicator.style.boxShadow = `0 0 10px ${flashColor}`;
    
    setTimeout(() => {
      indicator.style.background = originalColor;
      indicator.style.boxShadow = 'none';
    }, 500);
  }
}

// Initialize the game injector
let gameInjector = null;

// Start when the page is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    gameInjector = new GameInjector();
  });
} else {
  gameInjector = new GameInjector();
}

// Clean up on page unload
window.addEventListener('beforeunload', () => {
  if (gameInjector) {
    // Clean up if needed
  }
});