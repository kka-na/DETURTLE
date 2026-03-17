# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

**DETURTLE** — 실시간 웹캠 기반 거북목·굽은 등 감지 및 경고 서비스.
로컬 Node.js 서버(포트 2228) + Electron 플로팅 위젯 + 웹 대시보드.

## 실행 명령

```bash
# 서버
cd server && npm install && node index.js

# 위젯 (개발)
cd widget && npm install && npx electron .

# 대시보드 (개발)
cd dashboard && npm install && npm run dev
```

## 아키텍처

```
server/         Express + better-sqlite3 + ws (포트 2228)
  db/           SQLite 스키마 및 래퍼
  routes/       auth, scores, calibration, leaderboard, settings, breaks
  socket/       WebSocket 실시간 점수 업데이트

widget/         Electron 앱 (150×150px, always-on-top, frameless)
  main.js       Electron main process
  preload.js    contextBridge IPC
  renderer/     MoveNet 추론 + 자세 판정 + 위젯 UI

dashboard/      Vite + Vanilla JS (프로덕션은 서버가 정적 서빙)
  src/          Chart.js 점수 그래프 + 리더보드 UI
```

## 핵심 로직

**자세 판정**: MoveNet Lightning(TF.js)으로 17개 keypoint 추출 → `neck_ratio`(60%), `head_forward`(25%), `shoulder_sym`(15%) 가중 평균 → 캘리브레이션 기준 0~100 정규화 → 5단계 레벨.

**레벨 기준**: 85↑=Lv1(초록), 65↑=Lv2(연초록), 45↑=Lv3(노랑), 25↑=Lv4(주황), 0↑=Lv5(빨강🐢)

**캘리브레이션**: 바른자세 + 최악자세 각 30프레임 수집 → 서버 SQLite 저장 → 다음 실행 시 자동 로드.

**휴식 알림**: 포모도로 방식(기본 50분 작업/10분 휴식). Lv4~5가 10분+ 지속 시 조기 알림, Lv1~2 유지 시 최대 +15분 연장.

## DB 테이블

`users` / `calibrations` / `scores` (분당 저장) / `daily_summaries` / `break_logs` / `user_settings`

## 주의사항

- MoveNet SinglePose만 사용 → 화면에 한 명만 있어야 정확
- keypoint `score < 0.3` 이면 무시 (역광 대응)
- 귀 keypoint 가려지면 코(nose)로 fallback
- 추론 간격 기본 500ms (저사양 PC 대응)
- 리더보드 순위 지표: `avg_score * 0.7 + (Lv1+2 비율) * 30`
