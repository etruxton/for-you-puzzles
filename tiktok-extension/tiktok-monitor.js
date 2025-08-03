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
    
    console.log('TikTok Monitor: Checking if on live stream page...');
    console.log('Current URL:', window.location.href);
    console.log('Pathname:', window.location.pathname);
    
    // Check if we're on a live stream page
    if (!this.isLiveStreamPage()) {
      console.log('TikTok Monitor: Not on live stream page, retrying in 2 seconds');
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
    console.log('TikTok Monitor: Looking for chat container...');
    
    // More comprehensive selectors for 2025 TikTok
    const selectors = [
      // Live chat specific
      '[data-e2e="live-chat-container"]',
      '[data-e2e="comment-list"]',
      '[data-e2e="live-comment-list"]',
      // Class-based selectors
      '.chat-container',
      '.live-chat',
      '.comment-list',
      '.live-comment-list',
      // More generic patterns
      '[class*="LiveChatContainer"]',
      '[class*="CommentList"]',
      '[class*="ChatList"]',
      '[class*="chat"][class*="container"]',
      '[class*="comment"][class*="container"]',
      '[class*="live"][class*="chat"]',
      // Very broad selectors
      '[class*="chat"]',
      '[class*="comment"]',
      '[role="log"]',
      '[aria-label*="chat"]',
      '[aria-label*="comment"]'
    ];
    
    let chatContainer = null;
    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      for (const element of elements) {
        // Check if this element seems like a chat container
        const text = element.textContent.toLowerCase();
        const className = element.className.toLowerCase();
        if ((text.length > 50 && (text.includes('comment') || text.includes('chat'))) ||
            className.includes('chat') || className.includes('comment')) {
          chatContainer = element;
          console.log('TikTok Monitor: Found chat container with selector:', selector);
          break;
        }
      }
      if (chatContainer) break;
    }
    
    if (!chatContainer) {
      // If no chat container found, observe the entire document
      console.log('TikTok Monitor: Chat container not found, observing entire document');
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
    
    // Also scan existing comments once, then rely on mutation observer
    this.scanForComments(chatContainer);
    
    // Only do periodic scanning every 5 seconds as backup
    this.scanInterval = setInterval(() => {
      this.scanForComments(document.body);
    }, 5000);
    
    console.log('TikTok Monitor: Watching for comments in:', chatContainer);
  }
  
  scanForComments(element) {
    // Very comprehensive comment selectors for 2025 TikTok
    const commentSelectors = [
      // Data attributes
      '[data-e2e="comment-item"]',
      '[data-e2e="live-comment"]',
      '[data-e2e="live-comment-item"]',
      '[data-e2e="chat-item"]',
      '[data-e2e*="comment"]',
      '[data-e2e*="chat"]',
      // Class patterns
      '.comment-item',
      '.chat-item',
      '.live-comment',
      '.live-comment-item',
      '[class*="CommentItem"]',
      '[class*="ChatItem"]',
      '[class*="LiveComment"]',
      '[class*="comment-item"]',
      '[class*="chat-item"]',
      '[class*="live-comment"]',
      '[class*="comment"][class*="item"]',
      '[class*="chat"][class*="item"]',
      // Very broad patterns
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
    
    // AGGRESSIVE: Look for any element that might contain user-generated text
    if (comments.length === 0) {
      const potentialComments = element.querySelectorAll('div, span, p');
      for (const el of potentialComments) {
        const text = el.textContent?.trim();
        const classes = el.className;
        
        // Skip if it has children (likely a container)
        if (el.children.length > 0) continue;
        
        // Look for text that could be a comment (3-50 chars, not numbers/symbols only)
        if (text && text.length >= 3 && text.length <= 50 && 
            /[a-zA-Z]/.test(text) && 
            !text.startsWith('@') && 
            !text.match(/^\d+[smh]/) &&
            !text.includes('❤️') &&
            !text.includes('👍') &&
            !classes.includes('time') &&
            !classes.includes('timestamp')) {
          
          // Check if this might be a comment by looking at parent context
          let parent = el.parentElement;
          let depth = 0;
          while (parent && depth < 3) {
            const parentClasses = parent.className.toLowerCase();
            if (parentClasses.includes('comment') || 
                parentClasses.includes('chat') ||
                parent.hasAttribute('data-e2e')) {
              comments.push(el);
              break;
            }
            parent = parent.parentElement;
            depth++;
          }
        }
      }
    }
    
    // Process each comment
    comments.forEach(comment => this.processComment(comment));
    
    if (comments.length > 0) {
      console.log(`TikTok Monitor: Found ${comments.length} potential comments`);
    }
  }
  
  processComment(commentElement) {
    try {
      // Get a unique identifier for this comment to avoid duplicates
      const commentId = this.getCommentId(commentElement);
      if (this.processedComments.has(commentId)) {
        // console.log('Skipping already processed comment:', commentId.slice(0, 20));
        return;
      }
      
      // Extract comment text
      const commentText = this.extractCommentText(commentElement);
      if (!commentText || commentText.length < 3) {
        return;
      }
      
      // Extract user info
      const userInfo = this.extractUserInfo(commentElement);
      
      // Validate userInfo before proceeding
      if (!userInfo || !userInfo.username) {
        console.log('TikTok Monitor: Invalid user info, skipping comment');
        return;
      }
      
      // Mark as processed
      this.processedComments.add(commentId);
      
      // Keep only recent comments in memory (last 2000, never clear too aggressively)
      if (this.processedComments.size > 2000) {
        const commentsArray = Array.from(this.processedComments);
        this.processedComments = new Set(commentsArray.slice(-1000));
      }
      
      console.log('TikTok Comment:', userInfo.username, '->', commentText, '[ID:', commentId.slice(0, 20) + ']');
      console.log('DEBUG - Element:', commentElement);
      console.log('DEBUG - Element text:', commentElement.textContent);
      console.log('DEBUG - Element parent:', commentElement.parentElement);
      console.log('DEBUG - Parent text:', commentElement.parentElement?.textContent);
      
      // Send to background script - ensure userInfo is valid
      try {
        const messageData = {
          type: 'TIKTOK_COMMENT',
          comment: commentText,
          user: {
            username: userInfo.username || 'Unknown',
            avatar: userInfo.avatar || null,
            isFromTikTok: true
          }
        };
        
        chrome.runtime.sendMessage(messageData);
      } catch (error) {
        console.error('Failed to send comment to background script:', error);
      }
      
    } catch (error) {
      console.error('Error processing comment:', error);
    }
  }
  
  getCommentId(element) {
    // Create a unique ID based on element content and position, not timestamp
    const text = element.textContent || '';
    const className = element.className || '';
    const parentText = element.parentElement?.textContent?.slice(0, 100) || '';
    
    // Use content + position to create stable ID
    const stableId = `${text.slice(0, 50)}_${className}_${parentText.slice(0, 30)}`;
    return stableId.replace(/\s+/g, '_').slice(0, 100);
  }
  
  extractCommentText(element) {
    const fullText = element.textContent.trim();
    
    // Only skip if it's definitely a known username (be much more specific)
    if (fullText === 'Soothe Bell' || fullText === 'ISABLONKR') {
      return '';
    }
    
    // Smart extraction: Handle various patterns
    // Pattern 1: "Username/comment" - slash delimiter
    let slashMatch = fullText.match(/^.+?\/(.+)$/);
    if (slashMatch && slashMatch[1] && slashMatch[1].length >= 3) {
      return slashMatch[1].trim();
    }
    
    // Pattern 2: "Soothe Bellcomment" - extract after "Soothe Bell"
    if (fullText.startsWith('Soothe Bell')) {
      let comment = fullText.replace('Soothe Bell', '').trim();
      if (comment.length >= 3) {
        return comment;
      }
    }
    
    // Pattern 3: "UsernameNo. 1comment" - with number
    let numberMatch = fullText.match(/^([A-Za-z0-9._\s]+?)No\.\s*\d+([a-zA-Z]{3,})$/);
    if (numberMatch && numberMatch[2]) {
      return numberMatch[2].trim();
    }
    
    // Pattern 4: "ISABLONKRcomment" - extract after single word username
    let singleWordMatch = fullText.match(/^([A-Za-z0-9._]+)([a-zA-Z]{3,})$/);
    if (singleWordMatch && singleWordMatch[2]) {
      return singleWordMatch[2].trim();
    }
    
    // Pattern 5: Try to find word boundaries - look for the last word that could be a comment
    let words = fullText.split(/\s+/);
    if (words.length > 1) {
      let lastWord = words[words.length - 1];
      if (lastWord.length >= 3 && /^[a-zA-Z]+$/.test(lastWord)) {
        return lastWord;
      }
    }
    
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
        const text = textElement.textContent.trim();
        if (text && text !== fullText) { // Make sure it's not the same as the full element
          return text;
        }
      }
    }
    
    // Method 2: If this element has children, look for the longest text that's not a username
    if (element.children.length > 0) {
      const textElements = element.querySelectorAll('span, p, div');
      let longestText = '';
      
      for (const textElement of textElements) {
        const text = textElement.textContent.trim();
        
        // Skip usernames, timestamps, emojis
        if (text.length > 2 && 
            text.length > longestText.length &&
            !text.startsWith('@') && 
            !text.match(/^\d+[smh]/) && // timestamps
            !text.includes('❤️') && // hearts
            !text.includes('👍') &&
            textElement.children.length === 0 && // no child elements
            text !== 'Soothe Bell' &&
            text !== 'ISABLONKR') {
          longestText = text;
        }
      }
      
      if (longestText) {
        return longestText;
      }
    }
    
    // Method 3: Use the entire element text as fallback (removed overly restrictive filters)
    if (fullText.length > 2 && 
        fullText.length < 100 &&
        fullText !== 'Soothe Bell' &&
        fullText !== 'ISABLONKR') {
      return fullText;
    }
    
    return '';
  }
  
  extractUserInfo(element) {
    let username = 'Unknown';
    const elementText = element.textContent?.trim() || '';
    console.log('USERNAME DEBUG - Starting extraction for element:', elementText.slice(0, 50));
    
    // Smart username extraction: Handle known patterns first
    let extractedUsername = null;
    
    // Check for known usernames at the start
    if (elementText.startsWith('Soothe Bell')) {
      extractedUsername = 'Soothe Bell';
    } else if (elementText.startsWith('ISABLONKR')) {
      extractedUsername = 'ISABLONKR';
    } else {
      // Try to extract username from concatenated text
      const usernameMatch = elementText.match(/^([A-Za-z0-9._]+)(?:No\.\s*\d+|[a-z]{3,})/);
      if (usernameMatch && usernameMatch[1]) {
        const candidate = usernameMatch[1].trim();
        if (candidate.length >= 3 && candidate.length <= 25) {
          extractedUsername = candidate;
        }
      }
    }
    
    if (extractedUsername) {
      // Extract avatar from the element or its parents
      let avatar = null;
      let avatarSearchElement = element;
      for (let i = 0; i < 5; i++) { // Search deeper for avatar
        if (!avatarSearchElement) break;
        
        const avatarElement = avatarSearchElement.querySelector('img[src*="avatar"], img[alt*="avatar"], .avatar img, img');
        if (avatarElement && avatarElement.src && !avatarElement.src.includes('data:')) {
          avatar = avatarElement.src;
          console.log('AVATAR DEBUG - Found avatar:', avatar.slice(0, 50));
          break;
        }
        
        avatarSearchElement = avatarSearchElement.parentElement;
      }
      
      if (!avatar) {
        console.log('AVATAR DEBUG - No avatar found, searching siblings and nearby elements');
        // Search in parent's children for avatar
        if (element.parentElement) {
          const allImages = element.parentElement.querySelectorAll('img');
          for (const img of allImages) {
            if (img.src && !img.src.includes('data:') && img.src.includes('http')) {
              avatar = img.src;
              console.log('AVATAR DEBUG - Found avatar in siblings:', avatar.slice(0, 50));
              break;
            }
          }
        }
      }
      
      return {
        username: extractedUsername,
        avatar: avatar,
        isFromTikTok: true
      };
    }
    
    // Method 1: Look for specific username selectors
    let searchElement = element;
    for (let i = 0; i < 3; i++) {
      if (!searchElement) break;
      
      const usernameSelectors = [
        '[data-e2e="comment-username"]',
        '[data-e2e*="username"]',
        '.username',
        '.user-name',
        '.comment-username'
      ];
      
      for (const selector of usernameSelectors) {
        const usernameElement = searchElement.querySelector(selector);
        if (usernameElement) {
          const foundUsername = usernameElement.textContent.trim().replace('@', '');
          if (foundUsername && foundUsername !== 'Soothe Bell') {
            username = foundUsername;
            break;
          }
        }
      }
      
      if (username !== 'Unknown') break;
      searchElement = searchElement.parentElement;
    }
    
    // Method 2: Look for sibling elements that contain ONLY a username (no extra text)
    if (username === 'Unknown') {
      let searchElement = element;
      for (let i = 0; i < 2; i++) {
        if (!searchElement?.parentElement) break;
        
        const siblings = searchElement.parentElement.children;
        for (const sibling of siblings) {
          if (sibling === searchElement) continue;
          
          const siblingText = sibling.textContent.trim();
          
          // Username must be standalone - no spaces, reasonable length, alphanumeric
          if (siblingText.length >= 3 && siblingText.length <= 25 && 
              !siblingText.includes(' ') && // No spaces = not combined text
              siblingText.match(/^[a-zA-Z0-9_.]+$/) &&
              siblingText !== 'Soothe' && siblingText !== 'Bell' &&
              !siblingText.match(/^\d+$/) && // Skip pure numbers
              !siblingText.endsWith('.1') && // Skip "NO.1" style suffixes
              sibling.children.length === 0) { // Must be a leaf element
            
            username = siblingText.replace('@', '');
            break;
          }
        }
        
        if (username !== 'Unknown') break;
        searchElement = searchElement.parentElement;
      }
    }
    
    // Method 3: Parse words from parent text, but be very strict
    if (username === 'Unknown') {
      const parentElement = element.parentElement;
      if (parentElement) {
        // Get all direct child text nodes to avoid concatenated text
        const textNodes = [];
        for (const child of parentElement.childNodes) {
          if (child.nodeType === Node.TEXT_NODE) {
            const text = child.textContent.trim();
            if (text) textNodes.push(text);
          } else if (child.nodeType === Node.ELEMENT_NODE && child.children.length === 0) {
            const text = child.textContent.trim();
            if (text) textNodes.push(text);
          }
        }
        
        // Look for username-like standalone text
        for (const text of textNodes) {
          const words = text.split(/\s+/);
          for (const word of words) {
            if (word.length >= 3 && word.length <= 25 && 
                word.match(/^[a-zA-Z0-9_.]+$/) &&
                word !== 'Soothe' && word !== 'Bell' &&
                !word.match(/^\d+$/) &&
                !word.endsWith('.1')) {
              username = word.replace('@', '');
              break;
            }
          }
          if (username !== 'Unknown') break;
        }
      }
    }
    
    // Fallback: use a generic viewer name if we can't find a proper username
    if (username === 'Unknown' || username.length > 25) {
      console.log('USERNAME DEBUG - Using fallback viewer name');
      username = 'Viewer' + Math.floor(Math.random() * 1000);
    } else {
      console.log('USERNAME DEBUG - Found username:', username);
    }
    
    // Extract avatar if available - comprehensive search
    let avatar = null;
    let avatarSearchElement = element;
    
    // Search up the DOM tree for avatar
    for (let i = 0; i < 5; i++) {
      if (!avatarSearchElement) break;
      
      const avatarElement = avatarSearchElement.querySelector('img[src*="avatar"], img[alt*="avatar"], .avatar img, img');
      if (avatarElement && avatarElement.src && !avatarElement.src.includes('data:') && avatarElement.src.includes('http')) {
        avatar = avatarElement.src;
        console.log('AVATAR DEBUG - Found avatar in fallback search:', avatar.slice(0, 50));
        break;
      }
      
      avatarSearchElement = avatarSearchElement.parentElement;
    }
    
    // If still no avatar, search the entire comment container
    if (!avatar && element.closest('[data-e2e="chat-message"]')) {
      const chatMessage = element.closest('[data-e2e="chat-message"]');
      const allImages = chatMessage.querySelectorAll('img');
      for (const img of allImages) {
        if (img.src && !img.src.includes('data:') && img.src.includes('http')) {
          avatar = img.src;
          console.log('AVATAR DEBUG - Found avatar in chat message container:', avatar.slice(0, 50));
          break;
        }
      }
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
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
    this.isMonitoring = false;
    console.log('TikTok Comment Monitor: Stopped monitoring');
  }
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'PING') {
    sendResponse({ status: 'ok', monitoring: monitor ? monitor.isMonitoring : false });
  }
  return true;
});

// Debug function to manually scan for comments
window.debugTikTokComments = function() {
  console.log('=== MANUAL TIKTOK DEBUG ===');
  console.log('URL:', window.location.href);
  console.log('Page title:', document.title);
  
  // Look for any element that might contain comments
  const allElements = document.querySelectorAll('*');
  let foundElements = [];
  
  for (const el of allElements) {
    const text = el.textContent?.trim();
    const classes = el.className;
    
    if (text && text.length >= 3 && text.length <= 50 && 
        /[a-zA-Z]/.test(text) && 
        el.children.length === 0) {
      foundElements.push({
        element: el,
        text: text,
        classes: classes,
        tagName: el.tagName
      });
    }
  }
  
  console.log('Found', foundElements.length, 'potential text elements');
  foundElements.slice(0, 20).forEach((item, i) => {
    console.log(`${i+1}. "${item.text}" (${item.tagName}, classes: ${item.classes})`);
  });
  
  // Look for chat-related elements
  const chatElements = document.querySelectorAll('[class*="chat"], [class*="comment"], [data-e2e*="chat"], [data-e2e*="comment"]');
  console.log('Found', chatElements.length, 'chat/comment elements');
  chatElements.forEach((el, i) => {
    console.log(`Chat ${i+1}:`, el.tagName, el.className, el.getAttribute('data-e2e'));
  });
};

// Ultra-aggressive debug function - watches ALL DOM changes
window.debugAllDOMChanges = function() {
  console.log('=== WATCHING ALL DOM CHANGES ===');
  
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const text = node.textContent?.trim();
            if (text && text.length >= 3 && text.length <= 100) {
              console.log('NEW DOM ELEMENT:', {
                tag: node.tagName,
                text: text.slice(0, 50),
                classes: node.className,
                parent: node.parentElement?.tagName,
                parentClasses: node.parentElement?.className
              });
            }
          }
        });
      }
    });
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  console.log('DOM change watcher started - have someone comment now!');
  
  // Stop after 30 seconds
  setTimeout(() => {
    observer.disconnect();
    console.log('DOM change watcher stopped');
  }, 30000);
};

// Initialize the monitor
let monitor = null;

// Start monitoring when the page is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    monitor = new TikTokCommentMonitor();
    window.tiktokMonitor = monitor; // Make globally accessible
    console.log('TikTok Monitor initialized! Use debugTikTokComments() to debug.');
  });
} else {
  monitor = new TikTokCommentMonitor();
  window.tiktokMonitor = monitor; // Make globally accessible
  console.log('TikTok Monitor initialized! Use debugTikTokComments() to debug.');
}

// Clean up on page unload
window.addEventListener('beforeunload', () => {
  if (monitor) {
    monitor.stop();
  }
});