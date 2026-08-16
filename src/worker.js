export { GameRoom } from './game.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/ws' || url.pathname === '/api/current-game' || url.pathname === '/api/submit-word') {
      const id = env.GAME.idFromName('main');
      const stub = env.GAME.get(id);
      return stub.fetch(request);
    }

    // Everything else falls through to static assets (handled by wrangler assets config)
    return env.ASSETS.fetch(request);
  },
};
