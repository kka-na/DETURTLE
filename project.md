# 🐢 DETURTLE

> **"거북목? Deturtle yourself."**  
> 실시간 웹캠 기반 자세 모니터링 서비스 — 개인 위젯 + 팀 리더보드

---

## 이름 선정 근거

| 후보 | 설명 | 비고 |
|------|------|------|
| **DETURTLE** ✅ | De(제거) + Turtle(거북목) | 동사형, 직관적, turtle 직접 포함 |
| STRUT | Spine Tracking & Real-time Upright Tool | 거북목의 반대 이미지 |
| TURNIP | TURtle Neck Improvement Program | turnip(순무)와 발음 동일 |
| DBAT | Don't Be A Turtle | 직관적 |

→ **DETURTLE** 채택: 약자 없이 풀네임 자체가 브랜드. "deturtle yourself" 동사형으로 직관적.  
로고 아이디어: 거북이에 ❌ 표시 또는 거북이가 목을 쭉 펴는 실루엣

---

## 서비스 개요

- **목적**: 장시간 PC 작업자(연구실, 회사)의 거북목·굽은 등 실시간 감지 및 경고
- **형태**: 로컬 Node.js 서버 + 크로스플랫폼 플로팅 위젯 (Electron)
- **포트**: `2228`
- **ML 모델**: TensorFlow.js MoveNet Lightning (브라우저/Electron 내 추론)
- **플랫폼**: Windows / macOS / Ubuntu (Electron 크로스컴파일)

---

## 시스템 아키텍처

```
┌─────────────────────────────────────────────────────┐
│                  사용자 머신                          │
│                                                     │
│  ┌──────────────┐     WebSocket      ┌────────────┐ │
│  │   STRUT      │ ◄────────────────► │  Node.js   │ │
│  │  위젯        │                    │  Server    │ │
│  │ (Electron)   │     REST API       │  :2228     │ │
│  │  150×150px   │ ◄────────────────► │            │ │
│  │  always-top  │                    │  SQLite DB │ │
│  └──────────────┘                    └─────┬──────┘ │
│                                            │        │
│  ┌─────────────────────────────────────┐   │        │
│  │  대시보드  http://localhost:2228     │◄──┘        │
│  │  (브라우저) 점수 그래프 + 리더보드  │            │
│  └─────────────────────────────────────┘            │
└─────────────────────────────────────────────────────┘
```

### 컴포넌트 역할

| 컴포넌트 | 역할 |
|----------|------|
| **Electron 위젯** | 웹캠 캡처 → MoveNet 추론 → 자세 판정 → 화면 표시 |
| **Node.js 서버** | REST API, 점수 저장, 리더보드 집계, 정적 파일 서빙 |
| **SQLite DB** | 유저 정보, 캘리브레이션 데이터, 점수 이력 |
| **웹 대시보드** | 시간별/일별 점수 그래프, 팀 리더보드 |

---

## 프로젝트 구조

```
strut/
├── server/
│   ├── index.js                 # Express 서버 엔트리 (포트 2228)
│   ├── db/
│   │   ├── schema.sql           # DB 스키마
│   │   └── db.js                # better-sqlite3 래퍼
│   ├── routes/
│   │   ├── auth.js              # 로그인/회원가입
│   │   ├── scores.js            # 점수 저장/조회
│   │   ├── calibration.js       # 캘리브레이션 데이터 CRUD
│   │   └── leaderboard.js       # 리더보드 집계
│   └── socket/
│       └── scoreHandler.js      # WebSocket 실시간 점수 업데이트
│
├── widget/                      # Electron 앱
│   ├── main.js                  # Electron main process
│   ├── preload.js               # contextBridge IPC
│   └── renderer/
│       ├── index.html
│       ├── widget.js            # MoveNet + 자세 판정 로직
│       └── widget.css
│
├── dashboard/                   # 웹 대시보드 (Vite + Vanilla JS 또는 React)
│   ├── index.html
│   ├── src/
│   │   ├── main.js
│   │   ├── chart.js             # 점수 그래프 (Chart.js)
│   │   └── leaderboard.js       # 리더보드 UI
│   └── vite.config.js
│
├── package.json                 # 루트 (서버 의존성)
├── package.widget.json          # Electron 의존성 (별도 관리)
└── README.md
```

---

## 데이터베이스 스키마

```sql
-- 유저
CREATE TABLE users (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  username    TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  avatar_emoji TEXT DEFAULT '🧑',
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 캘리브레이션 데이터 (유저별)
CREATE TABLE calibrations (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL REFERENCES users(id),
  good_pose     TEXT NOT NULL,   -- JSON: {neck_ratio, shoulder_ratio, ...}
  bad_pose      TEXT NOT NULL,   -- JSON: {neck_ratio, shoulder_ratio, ...}
  camera_label  TEXT,            -- 웹캠 장치 ID
  updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 점수 이력 (분 단위 저장)
CREATE TABLE scores (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id),
  score       INTEGER NOT NULL,  -- 0~100
  level       INTEGER NOT NULL,  -- 1~5
  recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 일별 집계 (매일 자정 계산)
CREATE TABLE daily_summaries (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id),
  date        TEXT NOT NULL,     -- YYYY-MM-DD
  avg_score   REAL,
  time_good   INTEGER,           -- level 1~2 누적 분
  time_bad    INTEGER,           -- level 4~5 누적 분
  total_min   INTEGER
);
```

---

## 5단계 자세 판정 시스템

### 판정 기준

캘리브레이션으로 **바른자세(Good)** 와 **최악자세(Bad)** 를 저장한 뒤,
현재 자세가 그 사이 어디에 위치하는지 `0.0 ~ 1.0` 으로 정규화.

```
정규화 점수 = (현재 - Bad) / (Good - Bad)
→ 1.0에 가까울수록 바른 자세
```

| 레벨 | 정규화 점수 | 이모지 | 색상 | 위젯 테두리 | 메시지 |
|------|------------|--------|------|------------|--------|
| 1 | 0.85 ~ 1.0 | 😊 | `#2ECC71` 진초록 | 초록 glow | "완벽해요!" |
| 2 | 0.65 ~ 0.84 | 🙂 | `#82E0AA` 연초록 | 연초록 | "좋아요" |
| 3 | 0.45 ~ 0.64 | 😐 | `#F4D03F` 노랑 | 노랑 | "조금 펴세요" |
| 4 | 0.25 ~ 0.44 | 😟 | `#E67E22` 주황 | 주황 깜빡 | "등 굽어요!" |
| 5 | 0.0 ~ 0.24 | 🐢 | `#E74C3C` 빨강 | 빨강 강한 깜빡 | "거북이 됐어요! 목 피세요!" |

### 판정에 사용하는 키포인트 지표

```js
// MoveNet 17개 keypoint 기반
const metrics = {
  neck_ratio:   (shoulder_mid_y - ear_mid_y) / shoulder_width,  // 핵심: 귀-어깨 거리
  head_forward: nose_x 와 shoulder_mid_x 의 수평 오프셋 비율,     // 전방 돌출
  shoulder_sym: Math.abs(left_shoulder_y - right_shoulder_y) / shoulder_width, // 좌우 비대칭
};
```

---

## 캘리브레이션 플로우

```
[초기 실행]
     │
     ▼
캘리브레이션 모달 표시
     │
     ├─── STEP 1: "바른 자세를 취하세요"
     │         → 카운트다운 3초 → 30프레임 수집 → 평균 저장 (good_pose)
     │
     └─── STEP 2: "최대한 구부정하게 앉아보세요"
               → 카운트다운 3초 → 30프레임 수집 → 평균 저장 (bad_pose)
                         │
                         ▼
               서버 POST /api/calibration 에 저장
               이후 실시간 판정에 사용
```

- 캘리브레이션 데이터는 서버 SQLite에 저장 → 다음 실행 시 자동 로드
- 위젯 우클릭 메뉴 → "캘리브레이션 재설정" 으로 언제든 재실행 가능

---

## Electron 위젯 스펙

```
크기: 150 × 150 px (기본)
     → 레벨 5 경고 시 200 × 200 px 으로 잠깐 확대 (애니메이션)
위치: 화면 우하단 고정 (드래그로 이동 가능)
속성: always-on-top, frameless, transparent background
```

### 위젯 UI 구성 (150×150)

```
┌─────────────────┐
│  😊             │  ← 이모지 (중앙, 큰 폰트)
│                 │
│   deturtle      │  ← 서비스명 (소형, 소문자)
│   ████████░░    │  ← 점수 바 (레벨 색상)
│   87점  Lv.1    │  ← 점수 + 레벨
└─────────────────┘
```

- 이모지 탭 클릭 → 대시보드 브라우저 열기
- 우클릭 메뉴: 캘리브레이션 재설정 / 사용자 전환 / 휴식 설정 / 종료
- 위젯 하단 브랜드: `deturtle` (소문자, 심플하게)

---

## 휴식 알림 (Break Reminder)

### 개요

포모도로 방식 기반. 작업 시간 누적 → 자동 휴식 알림. 자세 점수와 연동해서 나쁜 자세가 지속되면 휴식 알림을 앞당김.

### 휴식 타이머 로직

```
기본 모드: 작업 N분 → 휴식 M분 (유저 설정)
기본값:    작업 50분 → 휴식 10분

자세 연동 보정:
  - 레벨 4~5 상태가 10분 이상 지속 → 휴식 알림 앞당김 (-10분)
  - 레벨 1~2 상태 유지 → 휴식 알림 뒤로 밀림 (+5분, 최대 +15분)
```

### 알림 단계

| 상황 | 위젯 변화 | 알림 메시지 |
|------|-----------|------------|
| 휴식 5분 전 | 하단에 카운트다운 표시 | "5분 후 휴식 시간이에요" |
| 휴식 시작 | 위젯 전체 파란색 깜빡 + OS 알림 | "🧘 지금 일어나세요! 목 스트레칭 추천" |
| 휴식 중 | 위젯에 휴식 카운트다운 | 😴 `휴식 중 08:42` |
| 휴식 종료 | 위젯 정상 복귀 | "다시 시작해요 💪" |

### 위젯 UI (휴식 카운트다운 포함)

```
┌─────────────────┐
│  😊             │  ← 이모지
│   deturtle      │
│   ████████░░    │  ← 자세 점수 바
│   87점  Lv.1    │
│  🕐 휴식 43:21  │  ← 휴식까지 남은 시간 (하단 추가)
└─────────────────┘
```

휴식 중일 때:
```
┌─────────────────┐
│  😴             │
│   break time    │
│   ░░░░░░░░░░    │  ← 휴식 진행 바 (파란색)
│   08:42 남음    │
│  ↩ 건너뛰기    │
└─────────────────┘
```

### 설정 항목

```javascript
// 우클릭 메뉴 → "휴식 설정" 에서 조정
const breakSettings = {
  work_minutes: 50,       // 작업 시간 (25 / 50 / 90 선택)
  break_minutes: 10,      // 휴식 시간 (5 / 10 / 15 선택)
  posture_adjust: true,   // 자세 연동 보정 on/off
  os_notification: true,  // OS 네이티브 알림 on/off
  sound: true,            // 알림음 on/off
};
```

### DB 스키마 추가

```sql
-- 휴식 이력
CREATE TABLE break_logs (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL REFERENCES users(id),
  work_minutes INTEGER NOT NULL,   -- 실제 작업한 분
  break_minutes INTEGER NOT NULL,  -- 실제 휴식한 분
  skipped      INTEGER DEFAULT 0,  -- 건너뛰기 여부
  started_at   DATETIME NOT NULL,
  ended_at     DATETIME
);

-- 유저 설정 (break settings 포함)
CREATE TABLE user_settings (
  user_id         INTEGER PRIMARY KEY REFERENCES users(id),
  work_minutes    INTEGER DEFAULT 50,
  break_minutes   INTEGER DEFAULT 10,
  posture_adjust  INTEGER DEFAULT 1,
  os_notification INTEGER DEFAULT 1,
  sound           INTEGER DEFAULT 1
);
```

### API 추가

```
GET    /api/settings/:userId              → 유저 설정 조회
PUT    /api/settings/:userId              { work_minutes, break_minutes, ... }
POST   /api/breaks                        { user_id, work_minutes, skipped }
GET    /api/breaks/:userId?date=YYYY-MM-DD → 당일 휴식 이력
```

---

## API 엔드포인트

### 인증

```
POST   /api/auth/register     { username, display_name }
POST   /api/auth/login        { username }
GET    /api/auth/me           → 현재 유저 정보
```

### 캘리브레이션

```
GET    /api/calibration/:userId       → 저장된 캘리브레이션
POST   /api/calibration/:userId       { good_pose, bad_pose, camera_label }
DELETE /api/calibration/:userId       → 초기화
```

### 점수

```
POST   /api/scores            { user_id, score, level }   → 분당 1회 저장
GET    /api/scores/:userId?range=today|week|month
GET    /api/scores/:userId/hourly?date=YYYY-MM-DD          → 시간대별 평균
```

### 리더보드

```
GET    /api/leaderboard?period=today|week|month
→ [{ rank, user_id, display_name, avg_score, time_good_pct }]
```

---

## 개발 단계 (Phase)

### Phase 1 — 서버 + 기본 감지 (Week 1)

- [ ] Node.js + Express 서버 셋업 (포트 2228)
- [ ] SQLite 스키마 생성 (better-sqlite3)
- [ ] 유저 등록/로그인 API
- [ ] 웹 페이지에서 웹캠 + MoveNet 동작 확인
- [ ] 캘리브레이션 API + 저장

### Phase 2 — 5단계 판정 + 위젯 기초 (Week 1~2)

- [ ] 정규화 점수 계산 로직 구현
- [ ] 5단계 레벨 판정 + 이모지/색상 매핑
- [ ] Electron 기본 위젯 (frameless, always-on-top, 150px)
- [ ] 위젯 ↔ 서버 WebSocket 연결
- [ ] 레벨 5 경고 시 진동(알림) + 확대 애니메이션

### Phase 3 — 점수 저장 + 대시보드 + 휴식 알림 (Week 2~3)

- [ ] 분당 점수 자동 저장 (서버 POST)
- [ ] 시간별 점수 그래프 (Chart.js)
- [ ] 일별 요약 계산
- [ ] 대시보드 웹 페이지 완성
- [ ] 휴식 타이머 로직 구현 (작업/휴식 카운트다운)
- [ ] 자세 점수 연동 보정 (레벨 4~5 지속 시 조기 알림)
- [ ] OS 네이티브 알림 (Electron `Notification` API)
- [ ] 위젯 휴식 모드 UI (파란색 카운트다운)
- [ ] 유저 설정 저장 API + 우클릭 설정 메뉴
- [ ] 휴식 이력 대시보드 반영

### Phase 4 — 리더보드 (Week 3)

- [ ] 팀 리더보드 API
- [ ] Wii-스타일 순위 UI (애니메이션 포함)
- [ ] 일/주/월 단위 필터
- [ ] 순위 변동 표시 (↑↓)

### Phase 5 — 패키징 + 배포 (Week 4)

- [ ] Electron Builder로 Windows/macOS/Linux 빌드
- [ ] 서버 PM2 자동시작 스크립트
- [ ] 설치 가이드 (README)
- [ ] (선택) 자동 업데이트 electron-updater

---

## 기술 스택

### 서버

```json
{
  "express": "^4.x",
  "better-sqlite3": "^9.x",
  "ws": "^8.x",
  "cors": "^2.x",
  "bcryptjs": "^2.x"
}
```

### Electron 위젯

```json
{
  "electron": "^29.x",
  "electron-builder": "^24.x",
  "@tensorflow/tfjs": "^4.x",
  "@tensorflow-models/pose-detection": "^2.x"
}
```

### 대시보드

```json
{
  "chart.js": "^4.x",
  "vite": "^5.x"
}
```

---

## 점수 계산 알고리즘 상세

```javascript
/**
 * 캘리브레이션 기반 점수 계산
 * @param {Object} currentMetrics - 현재 프레임 지표
 * @param {Object} goodPose       - 캘리브레이션 바른자세
 * @param {Object} badPose        - 캘리브레이션 최악자세
 * @returns {number} 0~100 점수
 */
function calcScore(currentMetrics, goodPose, badPose) {
  const weights = {
    neck_ratio:   0.60,   // 목 신장 (가장 중요)
    head_forward: 0.25,   // 머리 전방 돌출
    shoulder_sym: 0.15,   // 어깨 비대칭
  };

  let totalScore = 0;
  for (const [key, weight] of Object.entries(weights)) {
    const range = goodPose[key] - badPose[key];
    if (Math.abs(range) < 0.01) continue; // 범위 너무 작으면 스킵
    const normalized = (currentMetrics[key] - badPose[key]) / range;
    const clamped = Math.max(0, Math.min(1, normalized));
    totalScore += clamped * weight * 100;
  }

  return Math.round(totalScore);
}

/**
 * 점수 → 레벨 변환
 */
function scoreToLevel(score) {
  if (score >= 85) return 1;
  if (score >= 65) return 2;
  if (score >= 45) return 3;
  if (score >= 25) return 4;
  return 5;
}
```

---

## 리더보드 집계 로직

```
일별 점수 = 해당일 전체 기록의 평균 score
주간 점수 = 최근 7일 평균
순위 지표 = avg_score * 0.7 + (level1+2 비율) * 30
```

Wii 느낌을 위한 UI 요소:
- 1~3위 트로피 이모지 🥇🥈🥉
- 점수 변화 애니메이션 (카운트업)
- 순위 상승 시 초록 화살표, 하락 시 빨강

---

## 실행 방법

```bash
# 1. 서버 실행
cd strut/server
npm install
node index.js
# → http://localhost:2228

# 2. 위젯 실행 (개발)
cd strut/widget
npm install
npx electron .

# 3. 대시보드 개발
cd strut/dashboard
npm install
npm run dev    # Vite dev server (별도 포트)
# 프로덕션은 서버가 정적 파일 서빙
```

---

## 주의사항 / 알려진 한계

1. **정면 카메라 한계**: 측면 척추 곡률은 직접 측정 불가. 간접 지표(귀-어깨 비율) 사용.
2. **조명 민감도**: 역광 환경에서 keypoint 신뢰도 저하 → score 신뢰도 필터 추가 권장 (`score < 0.3` 인 keypoint 무시).
3. **안경/마스크**: 귀 keypoint 가려질 경우 코(nose)로 fallback.
4. **다중 인물**: MoveNet SinglePose 사용 → 화면에 한 명만 있어야 정확.
5. **CPU 부하**: MoveNet Lightning은 가볍지만 저사양 PC에서 추론 간격 조절 필요 (기본 500ms마다 추론 권장).

---

## 향후 확장 아이디어

- [ ] **사이드 카메라 모드**: 측면 웹캠 추가 시 더 정확한 척추 곡률 측정
- [ ] **Slack/Discord 봇**: 팀 채널에 일일 리더보드 자동 포스팅
- [ ] **iOS/Android 앱**: 같은 서버 API 재사용
- [ ] **ML 개선**: 개인별 데이터 누적 후 파인튜닝
- [ ] **스트레칭 가이드**: 휴식 알림 시 추천 스트레칭 동작 표시 (GIF)

---

*DETURTLE v0.1 — 프로젝트 가이드라인 | Claude Code 작업용*
