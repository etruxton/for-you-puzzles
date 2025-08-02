import asyncio
import threading
import json
import logging
from typing import Optional, Dict, Any, Callable
from datetime import datetime
from TikTokLive import TikTokLiveClient
from TikTokLive.events import CommentEvent, ConnectEvent, DisconnectEvent
import re

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class TikTokService:
    def __init__(self):
        self.client: Optional[TikTokLiveClient] = None
        self.is_connected = False
        self.username = None
        self.comment_callback: Optional[Callable] = None
        self.connection_callback: Optional[Callable] = None
        self.loop: Optional[asyncio.AbstractEventLoop] = None
        self.thread: Optional[threading.Thread] = None
        self.test_mode = False
        self.profile_picture_cache = {}
        
    def set_comment_callback(self, callback: Callable):
        """Set the callback function for when a comment is received"""
        self.comment_callback = callback
        
    def set_connection_callback(self, callback: Callable):
        """Set the callback function for connection status changes"""
        self.connection_callback = callback
        
    async def _on_connect(self, event: ConnectEvent):
        """Handle successful connection to TikTok Live"""
        logger.info(f"Connected to TikTok Live stream: {self.username}")
        self.is_connected = True
        if self.connection_callback:
            self.connection_callback(True, self.username)
            
    async def _on_disconnect(self, event: DisconnectEvent):
        """Handle disconnection from TikTok Live"""
        logger.info(f"Disconnected from TikTok Live stream: {self.username}")
        self.is_connected = False
        if self.connection_callback:
            self.connection_callback(False, self.username)
            
    async def _on_comment(self, event: CommentEvent):
        """Handle incoming comments from TikTok Live"""
        try:
            # Extract comment text and user info
            comment_text = event.comment
            user_info = {
                'username': event.user.nickname,
                'unique_id': event.user.unique_id,
                'user_id': event.user.user_id,
                'profile_picture': event.user.avatar_url if hasattr(event.user, 'avatar_url') else None,
                'is_follower': event.user.is_follower if hasattr(event.user, 'is_follower') else False,
                'is_friend': event.user.is_friend if hasattr(event.user, 'is_friend') else False,
            }
            
            logger.info(f"Comment from {user_info['username']}: {comment_text}")
            
            # Clean the comment text (remove emojis, extra spaces, etc.)
            clean_text = re.sub(r'[^\w\s]', '', comment_text).strip()
            
            # Split into words and process each one
            words = clean_text.split()
            
            for word in words:
                if word and len(word) >= 3:  # Minimum word length from the game
                    if self.comment_callback:
                        # Send each word separately
                        self.comment_callback(word.upper(), user_info)
                        
        except Exception as e:
            logger.error(f"Error processing comment: {e}")
            
    async def _run_client(self):
        """Run the TikTok client in the asyncio loop"""
        try:
            self.client = TikTokLiveClient(unique_id=self.username)
            
            # Register event handlers
            self.client.on(ConnectEvent)(self._on_connect)
            self.client.on(DisconnectEvent)(self._on_disconnect)
            self.client.on(CommentEvent)(self._on_comment)
            
            # Start the client
            await self.client.start()
            
        except Exception as e:
            logger.error(f"Error in TikTok client: {e}")
            self.is_connected = False
            if self.connection_callback:
                self.connection_callback(False, self.username, str(e))
                
    def _run_loop(self):
        """Run the asyncio event loop in a separate thread"""
        asyncio.set_event_loop(self.loop)
        self.loop.run_until_complete(self._run_client())
        
    def connect(self, username: str):
        """Connect to a TikTok Live stream"""
        if self.is_connected:
            self.disconnect()
            
        # Remove @ if present
        self.username = username.lstrip('@')
        
        logger.info(f"Attempting to connect to TikTok Live: @{self.username}")
        
        # Create new event loop in a separate thread
        self.loop = asyncio.new_event_loop()
        self.thread = threading.Thread(target=self._run_loop, daemon=True)
        self.thread.start()
        
    def disconnect(self):
        """Disconnect from TikTok Live stream"""
        if self.client and self.is_connected:
            logger.info("Disconnecting from TikTok Live")
            
            # Stop the client
            if self.loop:
                asyncio.run_coroutine_threadsafe(self.client.disconnect(), self.loop)
                
            self.is_connected = False
            self.client = None
            
            if self.connection_callback:
                self.connection_callback(False, None)
                
    def enable_test_mode(self, enabled: bool = True):
        """Enable or disable test mode"""
        self.test_mode = enabled
        logger.info(f"Test mode {'enabled' if enabled else 'disabled'}")
        
    def simulate_comment(self, comment: str, username: str = "TestUser"):
        """Simulate a TikTok comment for testing"""
        if not self.test_mode:
            logger.warning("Test mode is not enabled")
            return
            
        # Create fake user info
        user_info = {
            'username': username,
            'unique_id': f"test_{username.lower()}",
            'user_id': hash(username),
            'profile_picture': None,  # Generate avatar on frontend
            'is_follower': False,
            'is_friend': False,
        }
        
        logger.info(f"Simulated comment from {username}: {comment}")
        
        # Process words like a real comment
        clean_text = re.sub(r'[^\w\s]', '', comment).strip()
        words = clean_text.split()
        
        for word in words:
            if word and len(word) >= 3:
                if self.comment_callback:
                    self.comment_callback(word.upper(), user_info)
                    
    def get_connection_status(self) -> Dict[str, Any]:
        """Get current connection status"""
        return {
            'connected': self.is_connected,
            'username': self.username,
            'test_mode': self.test_mode
        }

# Global instance
tiktok_service = TikTokService()