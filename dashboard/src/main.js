import { renderChart, updateChart, updateChartDaily } from './chart.js';
import { renderLeaderboard } from './leaderboard.js';

const SERVER = '';
const $ = id => document.getElementById(id);

let userId = null, currentPeriod = 'today';

function kstToday() {
  return new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
}

function kstDate(offsetDays = 0) {
  return new Date(Date.now() + 9 * 3600000 + offsetDays * 86400000).toISOString().slice(0, 10);
}

async function login(username) {
  let res = await fetch(`${SERVER}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username }) });
  if (!res.ok) res = await fetch(`${SERVER}/api/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, display_name: username }) });
  return res.json();
}

function renderCalendar(dailyData, year, month) {
  const map = Object.fromEntries(dailyData.map(d => [d.day, d]));
  const firstDow = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const today = kstToday();

  const DAYS = ['일', '월', '화', '수', '목', '금', '토'];
  let html = `<div class="cal-header">${DAYS.map(d => `<div>${d}</div>`).join('')}</div><div class="cal-grid">`;

  for (let i = 0; i < firstDow; i++) html += `<div class="cal-cell empty"></div>`;

  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const row = map[key];
    const isToday = key === today;
    const bg = row ? scoreToColor(row.avg_score) : 'rgba(255,255,255,0.04)';
    html += `<div class="cal-cell${isToday ? ' today' : ''}" style="background:${bg}">
      <span class="cal-day">${d}</span>
      ${row ? `<span class="cal-score">${Math.round(row.avg_score)}</span>` : ''}
    </div>`;
  }
  html += '</div>';
  $('calendar').innerHTML = html;
}

function scoreToColor(score) {
  if (score >= 85) return 'rgba(46,204,113,0.35)';
  if (score >= 65) return 'rgba(130,224,170,0.3)';
  if (score >= 45) return 'rgba(244,208,63,0.3)';
  if (score >= 25) return 'rgba(230,126,34,0.3)';
  return 'rgba(231,76,60,0.3)';
}

async function loadData(period = currentPeriod) {
  const today = kstToday();
  const leaderboard = await fetch(`${SERVER}/api/leaderboard?period=${period}`).then(r => r.json());
  renderLeaderboard(leaderboard, userId);

  if (period === 'today') {
    $('score-chart').hidden = false;
    $('calendar').hidden = true;
    $('chart-title').textContent = '시간대별 자세 점수';
    const hourly = await fetch(`${SERVER}/api/scores/${userId}/hourly?date=${today}`).then(r => r.json());
    updateChart(hourly);

  } else if (period === 'week') {
    $('score-chart').hidden = false;
    $('calendar').hidden = true;
    $('chart-title').textContent = '일별 평균 점수 (최근 7일)';
    const labels = Array.from({ length: 7 }, (_, i) => kstDate(i - 6));
    const daily = await fetch(`${SERVER}/api/scores/${userId}/daily?start=${labels[0]}&end=${today}`).then(r => r.json());
    updateChartDaily(daily, labels);

  } else if (period === 'month') {
    $('score-chart').hidden = true;
    $('calendar').hidden = false;
    $('chart-title').textContent = '월간 자세 점수';
    const kst = new Date(Date.now() + 9 * 3600000);
    const year = kst.getFullYear(), month = kst.getMonth() + 1;
    const start = `${year}-${String(month).padStart(2,'0')}-01`;
    const daily = await fetch(`${SERVER}/api/scores/${userId}/daily?start=${start}&end=${today}`).then(r => r.json());
    renderCalendar(daily, year, month);
  }
}

async function showDashboard(user) {
  userId = user.id;
  $('login-overlay').hidden = true;
  $('main-header').hidden = false;
  $('main-content').hidden = false;
  $('user-greeting').textContent = `${user.avatar_emoji ?? '🧑'} ${user.display_name}`;

  renderChart($('score-chart'));
  await loadData();

  const wsHost = location.port === '5173' ? 'localhost:2228' : location.host;
  const ws = new WebSocket(`ws://${wsHost}`);
  ws.onopen = () => ws.send(JSON.stringify({ type: 'auth', userId }));
  ws.onmessage = ({ data }) => { if (JSON.parse(data).type === 'score') loadData(); };
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

const savedId = localStorage.getItem('userId');
if (savedId) {
  fetch(`${SERVER}/api/auth/me?id=${savedId}`).then(r => r.ok ? r.json() : null).then(user => user && showDashboard(user));
}
