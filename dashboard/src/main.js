import { renderChart, updateChart } from './chart.js';
import { renderLeaderboard } from './leaderboard.js';

const SERVER = '';  // same origin
const $ = id => document.getElementById(id);

let userId = null, currentPeriod = 'today';

async function login(username) {
  let res = await fetch(`${SERVER}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username }) });
  if (!res.ok) res = await fetch(`${SERVER}/api/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, display_name: username }) });
  return res.json();
}

async function loadData(period = currentPeriod) {
  const today = new Date().toISOString().slice(0, 10);
  const [hourly, leaderboard] = await Promise.all([
    fetch(`${SERVER}/api/scores/${userId}/hourly?date=${today}`).then(r => r.json()),
    fetch(`${SERVER}/api/leaderboard?period=${period}`).then(r => r.json()),
  ]);
  updateChart(hourly);
  renderLeaderboard(leaderboard, userId);
}

async function showDashboard(user) {
  userId = user.id;
  $('login-overlay').hidden = true;
  $('main-header').hidden = false;
  $('main-content').hidden = false;
  $('user-greeting').textContent = `${user.avatar_emoji} ${user.display_name}`;

  renderChart($('score-chart'));
  await loadData();

  // WebSocket for real-time updates
  const wsHost = location.port === '5173' ? 'localhost:2228' : location.host;
  const ws = new WebSocket(`ws://${wsHost}`);
  ws.onopen = () => ws.send(JSON.stringify({ type: 'auth', userId }));
  ws.onmessage = ({ data }) => {
    const msg = JSON.parse(data);
    if (msg.type === 'score') loadData();
  };
}

$('login-btn').onclick = async () => {
  const username = $('username-input').value.trim();
  if (!username) return;
  try {
    const user = await login(username);
    localStorage.setItem('userId', user.id);
    showDashboard(user);
  } catch (e) {
    alert('로그인 실패: ' + e.message);
  }
};

$('username-input').addEventListener('keydown', e => e.key === 'Enter' && $('login-btn').click());

$('period-tabs').onclick = ({ target }) => {
  if (!target.dataset.period) return;
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  target.classList.add('active');
  currentPeriod = target.dataset.period;
  loadData(currentPeriod);
};

// Auto-login
const savedId = localStorage.getItem('userId');
if (savedId) {
  fetch(`${SERVER}/api/auth/me?id=${savedId}`).then(r => r.ok ? r.json() : null).then(user => user && showDashboard(user));
}
