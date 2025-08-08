# For You Puzzles

**For You Puzzles (FYP)** is a real-time, interactive word search game designed for collaborative play. Website visitors can join in to solve the same puzzle together, and the experience can be extended with a TikTok Live integration, allowing viewers to submit words through chat.

The live version of the game can be found at [foryoupuzzles.com](https://foryoupuzzles.com).

## Features

- **Real-time Collaborative Gameplay:** All players on the website see the same puzzle and word submissions in real-time.
- **Interactive Word Search Grid:** A 10x10 grid of letters is generated for each puzzle, with words hidden in all directions.
- **Dynamic Word Lists:** Found words are instantly added to the "Puzzle Words" or "Bonus Words" lists for all players to see.
- **TikTok Live Integration:** A browser extension allows a host to connect their TikTok Live chat to the game, enabling viewers to submit words by commenting.
- **Player Avatars and Usernames:** Each player is assigned a unique, procedurally generated avatar and username for easy identification.
- **Game Timer:** Each puzzle has a 2-minute timer. If the puzzle is not solved in time, a summary screen shows the missed words.
- **Puzzle Completion Celebration:** When a puzzle is solved, a celebration screen appears with stats and an emoji grid of the results to share.

## Technologies Used

- **Backend:** Flask, Flask-SocketIO
- **Frontend:** HTML, CSS, JavaScript
- **Real-time Communication:** Socket.IO
- **TikTok Integration:** `TikTokLive` library (via a browser extension)

## Getting Started

To run the project locally, follow these steps:

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/for-you-puzzles.git
    cd for-you-puzzles
    ```

2.  **Create and activate a virtual environment:**
    ```bash
    python -m venv .venv
    source .venv/bin/activate  # On Windows, use `.venv\Scripts\activate`
    ```

3.  **Install the dependencies:**
    ```bash
    pip install -r requirements.txt
    ```

4.  **Run the application:**
    ```bash
    python app.py
    ```

5.  Open your browser and navigate to `http://127.0.0.1:5000`.

## TikTok Extension

The `tiktok-extension` directory contains a browser extension that connects a TikTok Live stream to the game.

### How it Works

- The extension injects a content script into the For You Puzzles website to listen for word submissions from the TikTok Live chat.
- Another content script runs on TikTok to monitor the Live chat for comments.
- A background service worker manages the communication between the two content scripts.

### Installation

1.  Open your browser's extension management page (e.g., `chrome://extensions`).
2.  Enable "Developer mode".
3.  Click "Load unpacked" and select the `tiktok-extension` directory.

### Usage

1.  Navigate to the For You Puzzles website.
2.  Open the extension popup and enter the username of a TikTok user who is currently live.
3.  Click "Connect".
4.  Viewers in the TikTok Live chat can now submit words by commenting.

## Deployment

The project is configured for deployment on platforms like Heroku using the `Procfile` and `runtime.txt` files. The `docker-compose.yml` and `Dockerfile` files also provide a way to run the application using Docker.
