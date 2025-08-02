# TikTok Word Search Bridge - Browser Extension

A Chrome extension that connects TikTok Live comments to your For You Puzzles word search game, allowing viewers to find words by typing them in the chat!

## 🚀 Features

- **Real-time TikTok Integration**: Monitors TikTok Live comments and automatically submits words to your game
- **Visual Feedback**: Shows notifications when TikTok viewers find words
- **Test Mode**: Simulate TikTok comments without going live (perfect for testing)
- **Clean UI**: Beautiful popup interface to manage connections
- **No Server Changes**: Works with your existing game without any backend modifications

## 📦 Installation

### Method 1: Load as Unpacked Extension (Recommended for local use)

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `tiktok-extension` folder
5. The extension should now appear in your extensions list

### Method 2: Create Icons (Optional)
Create icon files in the `icons/` folder:
- `icon16.png` (16x16 pixels)
- `icon48.png` (48x48 pixels) 
- `icon128.png` (128x128 pixels)

## 🎮 How to Use

### Setup
1. **Start your word search game**: Open `http://localhost:5000` in a browser tab
2. **Open the extension**: Click the extension icon in Chrome toolbar
3. **Check game status**: Should show "Game: Connected" in green

### Connect to TikTok Live
1. **Enter your username**: Type your TikTok username (e.g., `@soothe.bell`)
2. **Click "Connect to TikTok Live"**: This will open a TikTok tab
3. **Start your live stream**: Begin your TikTok Live broadcast
4. **Status should show connected**: Extension popup will show "TikTok: @yourusername" in green

### Watch the Magic!
- When viewers type words in your TikTok Live chat, the extension will:
  - Extract valid words (3+ letters, alphabetic only)
  - Submit them to your word search game
  - Show notifications when words are found
  - Credit the TikTok viewer who found each word

## 🧪 Test Mode

Perfect for testing before going live!

1. **Enable Test Mode**: Toggle the switch in the extension popup
2. **Enter test comments**: Type words in the test comment field
3. **Send test comments**: Click "Send Test Comment" or press Enter
4. **Watch results**: See how the integration works without being live

## 🔧 How It Works

### Architecture
```
TikTok Live Page → Extension Content Script → Background Script → Game Content Script → Your Game
```

### Components

1. **`manifest.json`**: Extension configuration and permissions
2. **`background.js`**: Service worker that manages communication between tabs
3. **`tiktok-monitor.js`**: Content script that monitors TikTok Live comments
4. **`game-injector.js`**: Content script that submits words to your game
5. **`popup.html/css/js`**: Extension popup interface

### Comment Processing
- Monitors TikTok Live chat for new comments
- Extracts words (3+ letters, alphabetic characters only)
- Filters duplicates and invalid entries
- Submits words via your game's existing API
- Shows visual feedback for successful finds

## 🛠️ Troubleshooting

### Common Issues

**"Game: Not Found" Status**
- Make sure your word search game is running on `http://localhost:5000`
- Refresh the game page
- Refresh the extension popup

**"TikTok: Not Connected" Status**
- Check that you're on a TikTok Live page
- Make sure you've started your live stream
- Try refreshing the TikTok tab

**Comments Not Being Detected**
- Verify you're actually live (not just on the live page)
- Check browser console for any errors
- Try test mode first to ensure game integration works

**Words Not Submitting**
- Ensure the game is active and has a current puzzle
- Check that words are valid (3+ letters, in the grid)
- Test with known words from the current puzzle

### Debug Mode
1. Open Chrome DevTools (F12)
2. Check the Console tab for error messages
3. Look for "TikTok Bridge:" messages to see what's happening

## 🎯 Tips for Best Results

### For Streamers
- Test the extension before going live using Test Mode
- Tell viewers to type individual words (not full sentences)
- Encourage viewers to try different words from the puzzle
- The extension works best with active, engaged chat

### For Viewers
- Type single words in chat to help find them
- Try both obvious and creative words
- Words need to be at least 3 letters long
- Only alphabetic characters count (no numbers/symbols)

## 🔒 Privacy & Security

- **Local Only**: Extension only works with localhost (your local game)
- **No Data Collection**: No personal data is stored or transmitted
- **TikTok Access**: Only monitors public live chat comments
- **Open Source**: All code is visible and auditable

## 🐛 Known Limitations

- **TikTok Changes**: May break if TikTok updates their chat interface
- **Rate Limiting**: Very fast chat might miss some comments
- **Browser Only**: Chrome/Edge only (Manifest V3)
- **Local Game**: Only works with localhost game instances

## 📝 Development Notes

This extension uses:
- **Manifest V3**: Latest Chrome extension format
- **Content Scripts**: To interact with both TikTok and your game
- **Service Worker**: For cross-tab communication
- **DOM Monitoring**: To detect new TikTok comments

## 🤝 Contributing

Feel free to improve the extension:
- Better TikTok comment detection
- Support for other streaming platforms
- Enhanced UI/UX improvements
- Bug fixes and optimizations

## 📄 License

This project is for personal/educational use. TikTok integration uses publicly available chat data only.