// Content script for TikTok.com - monitors live chat comments

class TikTokCommentMonitor {
  constructor() {
    this.isMonitoring = false;
    this.observer = null;
    this.processedComments = new Set();
    
    // Start monitoring when script loads
    this.startMonitoring();
    
    // Listen for navigation changes
    let lastUrl = location.href;
    new MutationObserver(() => {
      const currentUrl = location.href;
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        setTimeout(() => this.startMonitoring(), 1000);
      }
    }).observe(document, { subtree: true, childList: true });
  }
  
  startMonitoring() {
    if (this.isMonitoring) return;
    
    // Check if we're on a live stream page
    if (!this.isLiveStreamPage()) {
      setTimeout(() => this.startMonitoring(), 2000);
      return;
    }
    
    console.log('TikTok Comment Monitor: Starting to monitor live comments');
    this.isMonitoring = true;
    
    // Find the chat container
    this.findAndWatchChatContainer();
  }
  
  isLiveStreamPage() {
    return (
      location.pathname.includes('/live') ||
      document.querySelector('[data-e2e="live-chat-container"]') ||
      document.querySelector('[data-e2e="comment-list"]') ||
      document.querySelector('.chat-container') ||
      document.querySelector('.live-chat')
    );
  }
  
  findAndWatchChatContainer() {
    // Multiple selectors to find the chat container
    const selectors = [
      '[data-e2e="live-chat-container"]',
      '[data-e2e="comment-list"]',
      '.chat-container',
      '.live-chat',
      '[class*="chat"]',
      '[class*="comment"]',
      // Generic selectors as fallback
      '[role="log"]',
      '[aria-label*="chat"]',
      '[aria-label*="comment"]'
    ];
    
    let chatContainer = null;
    for (const selector of selectors) {
      chatContainer = document.querySelector(selector);
      if (chatContainer) break;
    }
    
    if (!chatContainer) {
      // If no chat container found, observe the entire document
      console.log('TikTok Monitor: Chat container not found, observing document');
      chatContainer = document.body;
    }
    
    // Set up mutation observer to watch for new comments
    this.observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              this.scanForComments(node);
            }
          });
        }
      }
    });
    
    this.observer.observe(chatContainer, {
      childList: true,
      subtree: true
    });
    
    // Also scan existing comments
    this.scanForComments(chatContainer);
    
    console.log('TikTok Monitor: Watching for comments in:', chatContainer);
  }
  
  scanForComments(element) {
    // Look for comment elements with various selectors
    const commentSelectors = [
      '[data-e2e="comment-item"]',
      '[data-e2e="live-comment"]',
      '.comment-item',
      '.chat-item',
      '.live-comment',
      '[class*="comment"]',
      '[class*="chat"]'
    ];
    
    const comments = [];
    
    // Check if the element itself is a comment
    for (const selector of commentSelectors) {
      if (element.matches && element.matches(selector)) {
        comments.push(element);
      }
    }
    
    // Find comments within the element
    for (const selector of commentSelectors) {
      const foundComments = element.querySelectorAll(selector);
      comments.push(...foundComments);
    }
    
    // Process each comment
    comments.forEach(comment => this.processComment(comment));
  }
  
  processComment(commentElement) {
    try {
      // Get a unique identifier for this comment to avoid duplicates
      const commentId = this.getCommentId(commentElement);
      if (this.processedComments.has(commentId)) {
        return;
      }
      
      // Extract comment text
      const commentText = this.extractCommentText(commentElement);
      if (!commentText || commentText.length < 3) {
        return;
      }
      
      // Extract user info
      const userInfo = this.extractUserInfo(commentElement);
      
      // Mark as processed
      this.processedComments.add(commentId);
      
      // Keep only recent comments in memory (last 1000)
      if (this.processedComments.size > 1000) {
        const commentsArray = Array.from(this.processedComments);
        this.processedComments = new Set(commentsArray.slice(-500));
      }
      
      console.log('TikTok Comment:', userInfo.username, '->', commentText);
      
      // Send to background script
      chrome.runtime.sendMessage({
        type: 'TIKTOK_COMMENT',
        comment: commentText,
        user: userInfo
      }).catch(console.error);
      
    } catch (error) {
      console.error('Error processing comment:', error);
    }
  }
  
  getCommentId(element) {
    // Create a unique ID based on text content and timestamp
    const text = element.textContent || '';
    const timestamp = Date.now();
    return `${text.slice(0, 50)}_${timestamp}`;
  }
  
  extractCommentText(element) {
    // Try different methods to extract comment text
    
    // Method 1: Look for specific comment text elements
    const textSelectors = [
      '[data-e2e="comment-text"]',
      '.comment-text',
      '.chat-text',
      '.message-text'
    ];
    
    for (const selector of textSelectors) {
      const textElement = element.querySelector(selector);
      if (textElement) {
        return textElement.textContent.trim();
      }
    }
    
    // Method 2: Look for elements that might contain text
    const potentialTextElements = element.querySelectorAll('span, p, div');
    for (const textElement of potentialTextElements) {
      const text = textElement.textContent.trim();
      // Skip elements that are likely usernames or metadata
      if (text.length > 2 && 
          !text.startsWith('@') && 
          !text.match(/^\d+[smh]/) && // timestamps
          !text.includes('❤️') && // hearts
          textElement.children.length === 0) { // no child elements
        return text;
      }
    }
    
    // Method 3: Use the entire element text as fallback
    const fullText = element.textContent.trim();
    if (fullText.length > 2) {
      return fullText;
    }
    
    return '';
  }
  
  extractUserInfo(element) {
    // Extract username
    let username = 'Unknown';
    
    const usernameSelectors = [
      '[data-e2e="comment-username"]',
      '.username',
      '.user-name',
      '.comment-username'
    ];
    
    for (const selector of usernameSelectors) {
      const usernameElement = element.querySelector(selector);
      if (usernameElement) {
        username = usernameElement.textContent.trim().replace('@', '');
        break;
      }
    }
    
    // If no username found, look for @mentions in text
    if (username === 'Unknown') {
      const text = element.textContent;
      const mention = text.match(/@([a-zA-Z0-9_.]+)/);
      if (mention) {
        username = mention[1];
      }
    }
    
    // Extract avatar if available
    let avatar = null;
    const avatarElement = element.querySelector('img[src*="avatar"], img[alt*="avatar"], .avatar img');
    if (avatarElement) {
      avatar = avatarElement.src;
    }
    
    return {
      username,
      avatar,
      isFromTikTok: true
    };
  }
  
  stop() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this.isMonitoring = false;
    console.log('TikTok Comment Monitor: Stopped monitoring');
  }
}

// Initialize the monitor
let monitor = null;

// Start monitoring when the page is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    monitor = new TikTokCommentMonitor();
  });
} else {
  monitor = new TikTokCommentMonitor();
}

// Clean up on page unload
window.addEventListener('beforeunload', () => {
  if (monitor) {
    monitor.stop();
  }
});