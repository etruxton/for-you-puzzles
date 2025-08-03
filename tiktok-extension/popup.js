// Popup script for TikTok Word Search Bridge

class PopupController {
  constructor() {
    this.status = {
      isConnected: false,
      gameTabId: null,
      tiktokTabId: null,
      username: '',
      testMode: false,
      gameTabActive: false,
      tiktokTabActive: false
    };
    
    this.initializeElements();
    this.bindEventListeners();
    this.loadStatus();
    
    // Listen for status updates from background
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'STATUS_UPDATE') {
        this.updateUI(message.status);
      }
    });
  }
  
  initializeElements() {
    // Status elements
    this.gameStatus = document.getElementById('game-status');
    this.tiktokStatus = document.getElementById('tiktok-status');
    this.gameIndicator = document.getElementById('game-indicator');
    this.tiktokIndicator = document.getElementById('tiktok-indicator');
    
    // Connection elements
    this.usernameInput = document.getElementById('username-input');
    this.connectBtn = document.getElementById('connect-btn');
    
    // Test mode elements
    this.testModeToggle = document.getElementById('test-mode-toggle');
    this.testControls = document.getElementById('test-controls');
    this.testComment = document.getElementById('test-comment');
    this.testUsername = document.getElementById('test-username');
    this.sendTestBtn = document.getElementById('send-test-btn');
    
    // Other buttons
    this.refreshBtn = document.getElementById('refresh-btn');
    this.reloadMonitorBtn = document.getElementById('reload-monitor-btn');
    this.helpBtn = document.getElementById('help-btn');
  }
  
  bindEventListeners() {
    // Connect button
    this.connectBtn.addEventListener('click', () => {
      if (this.status.isConnected) {
        this.disconnect();
      } else {
        this.connect();
      }
    });
    
    // Test mode toggle
    this.testModeToggle.addEventListener('change', () => {
      this.toggleTestMode();
    });
    
    // Send test comment
    this.sendTestBtn.addEventListener('click', () => {
      this.sendTestComment();
    });
    
    // Test comment input (Enter key)
    this.testComment.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.sendTestComment();
      }
    });
    
    // Refresh button
    this.refreshBtn.addEventListener('click', () => {
      this.loadStatus();
    });
    
    // Reload monitor button
    this.reloadMonitorBtn.addEventListener('click', () => {
      this.reloadTikTokMonitor();
    });
    
    // Help button
    this.helpBtn.addEventListener('click', () => {
      this.showHelp();
    });
  }
  
  async loadStatus() {
    try {
      // First get current status
      const response = await chrome.runtime.sendMessage({ type: 'GET_STATUS' });
      this.updateUI(response);
      
      // If game is not detected, trigger a re-check
      if (!response.gameTabActive) {
        console.log('Game not detected, triggering re-check...');
        await chrome.runtime.sendMessage({ type: 'RECHECK_GAME_TAB' });
        
        // Wait a moment and check status again
        setTimeout(async () => {
          try {
            const updatedResponse = await chrome.runtime.sendMessage({ type: 'GET_STATUS' });
            this.updateUI(updatedResponse);
          } catch (error) {
            console.error('Failed to get updated status:', error);
          }
        }, 1000);
      }
    } catch (error) {
      console.error('Failed to load status:', error);
    }
  }
  
  updateUI(status) {
    this.status = status;
    
    // Update game status
    if (status.gameTabActive) {
      this.gameStatus.textContent = 'Connected';
      this.gameIndicator.classList.add('connected');
    } else {
      this.gameStatus.textContent = 'Not Found';
      this.gameIndicator.classList.remove('connected');
    }
    
    // Update TikTok status
    if (status.isConnected && status.tiktokTabActive) {
      this.tiktokStatus.textContent = `@${status.username}`;
      this.tiktokIndicator.classList.add('connected');
      this.connectBtn.textContent = 'Disconnect';
      this.connectBtn.classList.add('connected');
    } else {
      this.tiktokStatus.textContent = 'Not Connected';
      this.tiktokIndicator.classList.remove('connected');
      this.connectBtn.textContent = 'Connect to TikTok Live';
      this.connectBtn.classList.remove('connected');
    }
    
    // Update username input
    if (status.username) {
      this.usernameInput.value = `@${status.username}`;
    }
    
    // Update test mode
    this.testModeToggle.checked = status.testMode;
    if (status.testMode) {
      this.testControls.classList.remove('hidden');
    } else {
      this.testControls.classList.add('hidden');
    }
    
    // Enable/disable controls based on game connection
    this.connectBtn.disabled = !status.gameTabActive;
    this.sendTestBtn.disabled = !status.gameTabActive;
  }
  
  async connect() {
    const username = this.usernameInput.value.trim();
    if (!username) {
      this.showError('Please enter a TikTok username');
      return;
    }
    
    this.connectBtn.disabled = true;
    this.connectBtn.textContent = 'Connecting...';
    
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'CONNECT_TIKTOK',
        username: username
      });
      
      if (response.success) {
        this.showSuccess(`Connected to ${username}`);
      } else {
        this.showError(response.error || 'Connection failed');
      }
    } catch (error) {
      this.showError('Connection failed: ' + error.message);
    } finally {
      this.connectBtn.disabled = false;
      this.loadStatus(); // Refresh status
    }
  }
  
  async disconnect() {
    try {
      await chrome.runtime.sendMessage({ type: 'DISCONNECT' });
      this.showSuccess('Disconnected from TikTok');
    } catch (error) {
      this.showError('Disconnect failed: ' + error.message);
    } finally {
      this.loadStatus();
    }
  }
  
  async toggleTestMode() {
    const enabled = this.testModeToggle.checked;
    
    try {
      await chrome.runtime.sendMessage({
        type: 'TOGGLE_TEST_MODE',
        enabled: enabled
      });
      
      if (enabled) {
        this.testControls.classList.remove('hidden');
        this.showSuccess('Test mode enabled');
      } else {
        this.testControls.classList.add('hidden');
        this.showSuccess('Test mode disabled');
      }
    } catch (error) {
      this.showError('Failed to toggle test mode');
      this.testModeToggle.checked = !enabled; // Revert
    }
  }
  
  async sendTestComment() {
    const comment = this.testComment.value.trim();
    const username = this.testUsername.value.trim() || 'TestUser';
    
    if (!comment) {
      this.showError('Please enter a test comment');
      return;
    }
    
    // Apply same safety filters as live comments
    if (comment.length > 10) {
      this.showError('Comment too long (max 10 characters)');
      return;
    }
    
    if (/\s/.test(comment)) {
      this.showError('Comment cannot contain spaces');
      return;
    }
    
    try {
      await chrome.runtime.sendMessage({
        type: 'SEND_TEST_COMMENT',
        comment: comment,
        username: username
      });
      
      this.testComment.value = '';
      this.showSuccess('Test comment sent!');
    } catch (error) {
      this.showError('Failed to send test comment');
    }
  }
  
  showSuccess(message) {
    this.showNotification(message, 'success');
  }
  
  showError(message) {
    this.showNotification(message, 'error');
  }
  
  showNotification(message, type) {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    // Style the notification
    Object.assign(notification.style, {
      position: 'fixed',
      top: '10px',
      left: '50%',
      transform: 'translateX(-50%)',
      background: type === 'success' ? '#4CAF50' : '#f44336',
      color: 'white',
      padding: '8px 16px',
      borderRadius: '4px',
      fontSize: '14px',
      zIndex: '1000',
      opacity: '0',
      transition: 'opacity 0.3s'
    });
    
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
      notification.style.opacity = '1';
    }, 10);
    
    // Remove after 3 seconds
    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }
  
  async reloadTikTokMonitor() {
    try {
      this.reloadMonitorBtn.disabled = true;
      this.reloadMonitorBtn.textContent = 'Reloading...';
      
      const response = await chrome.runtime.sendMessage({ type: 'RELOAD_TIKTOK_MONITOR' });
      
      if (response.success) {
        this.showSuccess('TikTok monitor reloaded successfully!');
      } else {
        this.showError(response.error || 'Failed to reload monitor');
      }
    } catch (error) {
      this.showError('Failed to reload monitor: ' + error.message);
    } finally {
      this.reloadMonitorBtn.disabled = false;
      this.reloadMonitorBtn.textContent = 'Reload Monitor';
      this.loadStatus();
    }
  }

  showHelp() {
    const helpText = `
TikTok Word Search Bridge Help:

1. Open your word search game (localhost:5000) in a browser tab
2. Enter your TikTok username (e.g., @soothe.bell)
3. Click "Connect to TikTok Live"
4. Start your TikTok Live stream
5. When viewers comment, words will be automatically submitted!

Test Mode:
- Enable test mode to simulate comments without going live
- Type test comments and see how they work
- Perfect for testing before your live stream

Troubleshooting:
- Make sure both tabs are open (game and TikTok)
- Refresh this popup if connection seems stuck
- Click "Reload Monitor" if TikTok comments aren't working
- The game tab should show "Connected" status

Note: This extension monitors TikTok comments and submits valid words to your game automatically.
    `;
    
    alert(helpText.trim());
  }
}

// Initialize the popup when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new PopupController();
  });
} else {
  new PopupController();
}