module.exports = (wss) => {
  const clients = new Map();

  wss.on('connection', (ws) => {
    let userId = null;

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data);
        if (msg.type === 'auth') {
          userId = msg.userId;
          if (!clients.has(userId)) clients.set(userId, new Set());
          clients.get(userId).add(ws);
        } else if (msg.type === 'score' && userId) {
          clients.get(userId)?.forEach(c => c !== ws && c.readyState === 1 && c.send(data));
        }
      } catch {}
    });

    ws.on('close', () => userId && clients.get(userId)?.delete(ws));
  });
};
