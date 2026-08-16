# For You Puzzles

A multiplayer word search game. Everyone on the site plays the same puzzle at the same time.

Live at [foryoupuzzles.com](https://foryoupuzzles.com).

## How it works

A 10x10 grid is generated with hidden words from a random category. Players have 2 minutes to find as many words as they can. Words are validated on the client and submitted over a WebSocket so other players see them instantly. Bonus words (valid words not in the target list) count too.

When the timer runs out or all words are found, a results screen shows what was missed and an emoji grid you can share.

## Stack

- Cloudflare Workers with Durable Objects (game state, WebSockets, timer)
- Vanilla HTML/CSS/JS frontend (served as static assets)
- No database, no framework, no build step

## Running locally

```bash
npm install
npx wrangler dev
```

Opens at `http://localhost:8787`.

## Deploying

Hosted on Cloudflare Workers. Pushes to `main` auto-deploy via GitHub Actions.

To deploy manually:

```bash
npx wrangler deploy
```

You'll need `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` set as secrets in your repo (or in your environment for manual deploys).
