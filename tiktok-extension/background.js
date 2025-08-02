// Background service worker for TikTok Word Search Bridge

class TikTokBridge {
  constructor() {
    this.isConnected = false;
    this.gameTabId = null;
    this.tiktokTabId = null;
    this.username = '';
    this.testMode = false;
    this.recentSubmissions = new Map(); // Track recent submissions to avoid spam
    
    // Setup message listeners
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true; // Keep channel open for async responses
    });
    
    // Monitor tab updates
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete') {
        this.checkTabs();
      }
    });
    
    chrome.tabs.onRemoved.addListener((tabId) => {
      if (tabId === this.gameTabId) {
        this.gameTabId = null;
      }
      if (tabId === this.tiktokTabId) {
        this.tiktokTabId = null;
        this.isConnected = false;
      }
      this.updateStatus();
    });
  }
  
  async handleMessage(message, sender, sendResponse) {
    try {
      switch (message.type) {
        case 'GET_STATUS':
          sendResponse(await this.getStatus());
          break;
          
        case 'CONNECT_TIKTOK':
          const result = await this.connectToTikTok(message.username);
          sendResponse(result);
          break;
          
        case 'DISCONNECT':
          await this.disconnect();
          sendResponse({ success: true });
          break;
          
        case 'TOGGLE_TEST_MODE':
          this.testMode = message.enabled;
          await this.updateStatus();
          sendResponse({ success: true, testMode: this.testMode });
          break;
          
        case 'SEND_TEST_COMMENT':
          if (this.testMode) {
            await this.processComment(message.comment, {
              username: message.username || 'TestUser',
              isTest: true
            });
          }
          sendResponse({ success: true });
          break;
          
        case 'GAME_TAB_READY':
          this.gameTabId = sender.tab.id;
          await this.updateStatus();
          sendResponse({ success: true });
          break;
          
        case 'TIKTOK_COMMENT':
          if (this.isConnected && sender.tab.id === this.tiktokTabId) {
            await this.processComment(message.comment, message.user);
          }
          sendResponse({ success: true });
          break;
          
        default:
          sendResponse({ error: 'Unknown message type' });
      }
    } catch (error) {
      console.error('Background script error:', error);
      sendResponse({ error: error.message });
    }
  }
  
  async getStatus() {
    return {
      isConnected: this.isConnected,
      gameTabId: this.gameTabId,
      tiktokTabId: this.tiktokTabId,
      username: this.username,
      testMode: this.testMode,
      gameTabActive: this.gameTabId ? await this.isTabActive(this.gameTabId) : false,
      tiktokTabActive: this.tiktokTabId ? await this.isTabActive(this.tiktokTabId) : false
    };
  }
  
  async connectToTikTok(username) {
    try {
      this.username = username.replace('@', '');
      
      // Find or create TikTok tab
      const tiktokUrl = `https://www.tiktok.com/@${this.username}/live`;
      
      // Check if TikTok tab already exists
      const tabs = await chrome.tabs.query({ url: '*://*.tiktok.com/*' });
      let tiktokTab = tabs.find(tab => tab.url.includes(this.username));
      
      if (!tiktokTab) {
        // Create new tab
        tiktokTab = await chrome.tabs.create({
          url: tiktokUrl,
          active: false
        });
      } else {
        // Update existing tab
        await chrome.tabs.update(tiktokTab.id, { url: tiktokUrl });
      }
      
      this.tiktokTabId = tiktokTab.id;
      this.isConnected = true;
      
      await this.updateStatus();
      
      return {
        success: true,
        message: `Connected to @${this.username}`,
        tabId: this.tiktokTabId
      };
      
    } catch (error) {
      console.error('Connection error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  async disconnect() {
    this.isConnected = false;
    this.tiktokTabId = null;
    this.username = '';
    await this.updateStatus();
  }
  
  async processComment(commentText, user) {
    if (!this.gameTabId) {
      console.log('No game tab available');
      return;
    }
    
    // Safety filters for comment processing
    if (!commentText || commentText.length > 10) {
      console.log(`Skipping comment: too long (${commentText?.length} chars)`);
      return;
    }
    
    if (/\s/.test(commentText)) {
      console.log('Skipping comment: contains whitespace');
      return;
    }
    
    // Extract words from comment (3+ letters, alphabetic only)
    const words = commentText
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length >= 3 && /^[a-zA-Z]+$/.test(word))
      .map(word => word.toUpperCase());
    
    // Send each word to the game (with spam prevention)
    for (const word of words) {
      // Create a key to track recent submissions from this user for this word
      const submissionKey = `${user.username}_${word}`;
      const now = Date.now();
      
      // Check if this user submitted this word recently (within 10 seconds)
      if (this.recentSubmissions.has(submissionKey)) {
        const lastSubmission = this.recentSubmissions.get(submissionKey);
        if (now - lastSubmission < 10000) {
          console.log(`Skipping duplicate word "${word}" from ${user.username}`);
          continue;
        }
      }
      
      // Record this submission
      this.recentSubmissions.set(submissionKey, now);
      
      // Clean up old submissions (older than 1 minute)
      for (const [key, timestamp] of this.recentSubmissions.entries()) {
        if (now - timestamp > 60000) {
          this.recentSubmissions.delete(key);
        }
      }
      
      try {
        await chrome.tabs.sendMessage(this.gameTabId, {
          type: 'SUBMIT_WORD',
          word: word,
          user: {
            username: user.username,
            isFromTikTok: true,
            isTest: user.isTest || false,
            avatar: user.avatar || null
          }
        });
      } catch (error) {
        console.error('Failed to send word to game:', error);
      }
    }
  }
  
  async updateStatus() {
    // Notify popup of status change
    try {
      await chrome.runtime.sendMessage({
        type: 'STATUS_UPDATE',
        status: await this.getStatus()
      });
    } catch (error) {
      // Popup might not be open
    }
  }
  
  async isTabActive(tabId) {
    try {
      const tab = await chrome.tabs.get(tabId);
      return tab && tab.url && !tab.discarded;
    } catch {
      return false;
    }
  }
  
  async checkTabs() {
    // Verify tabs are still valid
    if (this.gameTabId && !(await this.isTabActive(this.gameTabId))) {
      this.gameTabId = null;
    }
    if (this.tiktokTabId && !(await this.isTabActive(this.tiktokTabId))) {
      this.tiktokTabId = null;
      this.isConnected = false;
    }
    
    await this.updateStatus();
  }
}

// Initialize the bridge
const bridge = new TikTokBridge();

// Handle extension install/update
chrome.runtime.onInstalled.addListener(() => {
  console.log('TikTok Word Search Bridge installed');
});