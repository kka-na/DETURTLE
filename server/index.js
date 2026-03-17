const express = require('express');
const cors = require('cors');
const http = require('http');
const { WebSocketServer } = require('ws');
const path = require('path');

const app = express();
app.use(cors(), express.json());

['auth', 'calibration', 'scores', 'leaderboard', 'settings', 'breaks'].forEach(r =>
  app.use(`/api/${r}`, require(`./routes/${r}`))
);

app.use('/movenet', express.static(path.join(__dirname, 'public/movenet')));
const dist = path.join(__dirname, '../dashboard/dist');
app.use(express.static(dist));
app.get('*', (_, res) => res.sendFile(path.join(dist, 'index.html')));

const server = http.createServer(app);
require('./socket/scoreHandler')(new WebSocketServer({ server }));
server.listen(2228, () => console.log('DETURTLE :2228'));
