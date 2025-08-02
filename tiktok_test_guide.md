# TikTok Integration Test Guide

## Overview
The word search game now supports TikTok Live integration, allowing viewers to find words by typing them in the live chat.

## Features

### 1. TikTok Live Connection
- Connect to your TikTok Live stream using your username (@soothe.bell)
- Real-time capture of viewer comments
- Automatic word detection from comments

### 2. Visual Feedback
- TikTok users' profile pictures and usernames displayed when they find words
- Special pink highlight animation for TikTok-found words
- Regular players still get colored highlights based on their ID

### 3. Test Mode
- Click the "Test" button to open the test panel
- Simulate TikTok comments without being live
- Test with different usernames and comments

## How to Test

### Local Testing (Without TikTok Live)
1. Run the Flask app: `python app.py`
2. Open http://localhost:5000
3. Click the "Test" button next to the TikTok connect button
4. Enter test comments containing words from the puzzle
5. Watch as the words are found and credited to the test user

### TikTok Live Testing
1. Start your TikTok Live stream
2. Enter your username (without @) in the input field
3. Click "Connect to TikTok Live"
4. Wait for the status to show "Connected"
5. Ask viewers to type words in the chat
6. Words will be automatically detected and highlighted

## Technical Details

### Backend
- Uses TikTokLive Python library to capture live comments
- Runs in a separate thread to avoid blocking the main app
- Filters comments to extract valid words (3+ letters)
- Integrates with existing game logic

### Frontend
- Shows connection status in real-time
- Displays TikTok usernames and avatars
- Maintains compatibility with regular web players
- Responsive design for mobile devices

## Error Handling
- Connection errors are displayed to the user
- Game continues to work normally if TikTok connection fails
- Graceful fallback to regular gameplay

## Important Notes
- The TikTok integration uses an unofficial API
- Connection may fail if TikTok changes their system
- Always test with the test mode first
- The game remains fully functional without TikTok connection