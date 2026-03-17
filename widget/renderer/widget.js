let SERVER, WS_URL;

const LEVELS = [,
  { emoji: '😊', color: '#2ECC71', msg: '완벽해요!' },
  { emoji: '🙂', color: '#82E0AA', msg: '좋아요' },
  { emoji: '😐', color: '#F4D03F', msg: '조금 펴세요' },
  { emoji: '😟', color: '#E67E22', msg: '등 굽어요!' },
  { emoji: '🐢', color: '#E74C3C', msg: '거북이 됐어요! 목 피세요!' },
];

// State
let userId = null, calibration = null, detector = null, ws = null;
let settings = { work_minutes: 50, break_minutes: 10, posture_adjust: 1, os_notification: 1 };
let workStart = Date.now(), badMinutes = 0, goodStreak = 0, inBreak = false, breakStart = null;
let lastScorePost = 0, frameTimer = null;

// DOM
const $ = id => document.getElementById(id);
const setupView = $('setup-view');
const loginView = $('login-view'), calibView = $('calib-view'), widgetView = $('widget-view');
const video = $('video'), canvas = $('canvas');

async function initConfig() {
  let { serverUrl } = await api.getConfig();
  if (!serverUrl) {
    setupView.hidden = false;
    serverUrl = await new Promise(resolve => {
      $('setup-btn').onclick = async () => {
        const url = $('server-input').value.trim().replace(/\/$/, '');
        if (!url) return;
        await api.saveConfig({ serverUrl: url });
        resolve(url);
      };
    });
    setupView.hidden = true;
  }
  SERVER = serverUrl;
  WS_URL = serverUrl.replace(/^http/, 'ws');
}

// Score logic
function calcScore(cur, good, bad) {
  const w = { neck_ratio: 0.6, head_forward: 0.25, shoulder_sym: 0.15 };
  return Math.round(Object.entries(w).reduce((sum, [k, wt]) => {
    const range = good[k] - bad[k];
    if (Math.abs(range) < 0.01) return sum;
    return sum + Math.max(0, Math.min(1, (cur[k] - bad[k]) / range)) * wt * 100;
  }, 0));
}
const scoreToLevel = s => s >= 85 ? 1 : s >= 65 ? 2 : s >= 45 ? 3 : s >= 25 ? 4 : 5;

function extractMetrics(kp) {
  const get = i => kp[i];
  const [nose, , , le, re, ls, rs] = kp;
  const shoulder_width = Math.abs(ls.x - rs.x);
  const shoulder_mid_x = (ls.x + rs.x) / 2;
  const shoulder_mid_y = (ls.y + rs.y) / 2;
  const earL = le.score > 0.3 ? le : nose;
  const earR = re.score > 0.3 ? re : nose;
  const ear_mid_y = (earL.y + earR.y) / 2;
  if (shoulder_width < 1) return null;
  return {
    neck_ratio:   (shoulder_mid_y - ear_mid_y) / shoulder_width,
    head_forward: (nose.x - shoulder_mid_x) / shoulder_width,
    shoulder_sym: Math.abs(ls.y - rs.y) / shoulder_width,
  };
}

// UI update
function updateUI(score, level) {
  const lv = LEVELS[level];
  $('emoji').textContent = lv.emoji;
  document.body.style.boxShadow = `inset 0 0 8px ${lv.color}`;

  // Blink border for level 4-5
  document.body.classList.toggle('blink', level >= 4);
}

// Break timer
function updateBreakTimer() {
  const now = Date.now();
  let effectiveWork = settings.work_minutes;
  if (settings.posture_adjust) {
    effectiveWork -= Math.min(10, Math.floor(badMinutes / 10) * 10);
    effectiveWork += Math.min(15, Math.floor(goodStreak / 10) * 5);
  }

  if (!inBreak) {
    const elapsed = (now - workStart) / 60000;
    const remaining = effectiveWork - elapsed;
    const timerEl = $('break-timer');

    if (remaining <= 5 && remaining > 0) {
      timerEl.textContent = `🕐 휴식 ${Math.ceil(remaining)}분 전`;
      timerEl.hidden = false;
    } else if (remaining <= 0) {
      startBreak();
    } else {
      timerEl.hidden = true;
    }
  } else {
    const breakElapsed = (now - breakStart) / 60000;
    const remaining = settings.break_minutes - breakElapsed;
    if (remaining <= 0) endBreak();
    else {
      const m = Math.floor(remaining), s = Math.floor((remaining % 1) * 60);
      $('break-timer').textContent = `😴 ${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')} 남음`;
    }
  }
}

function startBreak() {
  inBreak = true;
  breakStart = Date.now();
  $('emoji').textContent = '😴';
  $('break-timer').hidden = false;
  if (settings.os_notification) api.notify('DETURTLE', '🧘 지금 일어나세요! 목 스트레칭 추천');
  fetch(`${SERVER}/api/breaks`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, work_minutes: Math.round((Date.now() - workStart) / 60000), skipped: false, started_at: new Date().toISOString() }) });
}

function endBreak() {
  inBreak = false;
  badMinutes = 0;
  goodStreak = 0;
  workStart = Date.now();
}

// MoveNet frame processing
async function processFrame() {
  if (!detector || !calibration || inBreak) return;
  const poses = await detector.estimatePoses(video);
  if (!poses.length) return;
  const kp = poses[0].keypoints;
  if (kp[5].score < 0.3 || kp[6].score < 0.3) return; // need shoulders

  const metrics = extractMetrics(kp);
  if (!metrics) return;

  const score = calcScore(metrics, calibration.good_pose, calibration.bad_pose);
  const level = scoreToLevel(score);
  updateUI(score, level);

  // Break posture tracking (per minute approx)
  if (level >= 4) badMinutes += 0.5 / 60;
  else if (level <= 2) goodStreak += 0.5 / 60;

  updateBreakTimer();

  // Post score every minute
  const now = Date.now();
  if (now - lastScorePost >= 60000) {
    lastScorePost = now;
    fetch(`${SERVER}/api/scores`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, score, level }) });
    ws?.readyState === WebSocket.OPEN && ws.send(JSON.stringify({ type: 'score', userId, score, level }));
  }
}

// WebSocket
function connectWS() {
  ws = new WebSocket(WS_URL);
  ws.onopen = () => ws.send(JSON.stringify({ type: 'auth', userId }));
  ws.onclose = () => setTimeout(connectWS, 3000);
}

// Camera
async function startCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({ video: true });
  video.srcObject = stream;
  await new Promise(r => video.onloadedmetadata = r);
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  frameTimer = setInterval(processFrame, 1500);
}

// Calibration
async function runCalibration() {
  api.resize(720, 620);
  calibView.hidden = false;
  loginView.hidden = true;
  $('calib-start-btn').hidden = false;

  const calibVideo = $('calib-video');
  const stream = await navigator.mediaDevices.getUserMedia({ video: true });
  calibVideo.srcObject = stream;

  const collect = async (label) => {
    $('calib-msg').textContent = label;
    for (let i = 3; i > 0; i--) {
      $('calib-count').textContent = i;
      await new Promise(r => setTimeout(r, 1000));
    }
    $('calib-count').textContent = '측정 중...';
    const frames = [];
    for (let i = 0; i < 30; i++) {
      const p = await detector.estimatePoses(calibVideo);
      if (p.length) frames.push(extractMetrics(p[0].keypoints));
      await new Promise(r => setTimeout(r, 100));
    }
    const valid = frames.filter(Boolean);
    return {
      neck_ratio:   valid.reduce((s, f) => s + f.neck_ratio, 0) / valid.length,
      head_forward: valid.reduce((s, f) => s + f.head_forward, 0) / valid.length,
      shoulder_sym: valid.reduce((s, f) => s + f.shoulder_sym, 0) / valid.length,
    };
  };

  await new Promise(r => $('calib-start-btn').onclick = r);
  $('calib-start-btn').hidden = true;

  const good_pose = await collect('바른 자세를 취하세요');
  const bad_pose  = await collect('최대한 구부정하게 앉아보세요');

  stream.getTracks().forEach(t => t.stop());

  await fetch(`${SERVER}/api/calibration/${userId}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ good_pose, bad_pose }),
  });
  calibration = { good_pose, bad_pose };

  // 캘리브 뷰 숨기고 → resize 반영 대기 → 위젯 시작
  calibView.hidden = true;
  await new Promise(r => setTimeout(r, 100));
  api.resize(100, 100, true);
  await new Promise(r => setTimeout(r, 150));
  await startWidget();
}

async function startWidget() {
  widgetView.hidden = false;
  connectWS();
  await startCamera();
}

const initDetector = () => poseDetection.createDetector(
  poseDetection.SupportedModels.MoveNet,
  { modelUrl: 'http://localhost:2228/movenet/model.json' }
);

async function startSession(uid) {
  userId = uid;
  localStorage.setItem('userId', uid);
  settings = await fetch(`${SERVER}/api/settings/${uid}`).then(r => r.json());
  const calibRes = await fetch(`${SERVER}/api/calibration/${uid}`);
  $('emoji').textContent = '⏳';
  detector = await initDetector();
  if (calibRes.ok) {
    calibration = await calibRes.json();
    loginView.hidden = true;
    await startWidget();
  } else {
    await runCalibration();
  }
}

// Login
$('login-btn').onclick = async () => {
  const username = $('username-input').value.trim();
  if (!username) return;
  const btn = $('login-btn');
  btn.textContent = '로딩 중...'; btn.disabled = true;
  try {
    let res = await fetch(`${SERVER}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username }) });
    if (!res.ok) res = await fetch(`${SERVER}/api/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, display_name: username }) });
    await startSession((await res.json()).id);
  } catch (e) {
    console.error('startSession error:', e);
    btn.textContent = '시작'; btn.disabled = false;
    $('username-input').value = '';
    $('username-input').placeholder = e.message;
  }
};

$('menu-btn').onclick = () => api.showMenu();

// Actions from main process
api.onAction(async (action) => {
  if (action === 'recalibrate') {
    clearInterval(frameTimer);
    video.srcObject?.getTracks().forEach(t => t.stop());
    widgetView.hidden = true;
    await runCalibration();
  } else if (action === 'switch-user') {
    localStorage.removeItem('userId');
    location.reload();
  } else if (action === 'break-settings') {
    $('work-min').value = settings.work_minutes;
    $('break-min').value = settings.break_minutes;
    $('break-modal').hidden = false;
  }
});

$('save-settings').onclick = async () => {
  settings.work_minutes = +$('work-min').value;
  settings.break_minutes = +$('break-min').value;
  await fetch(`${SERVER}/api/settings/${userId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings) });
  $('break-modal').hidden = true;
};

(async () => {
  await initConfig();
  loginView.hidden = false;

  const savedId = localStorage.getItem('userId');
  if (savedId) {
    try {
      const res = await fetch(`${SERVER}/api/auth/me?id=${savedId}`);
      if (!res.ok) { localStorage.removeItem('userId'); return; }
      await startSession(+(await res.json()).id);
    } catch (e) {
      console.error('Auto-login failed:', e);
    }
  }
})();
