const RANK_EMOJI = ['🥇', '🥈', '🥉'];

export function renderLeaderboard(rows, myUserId) {
  document.getElementById('leaderboard').innerHTML = rows.map(({ rank, user_id, display_name, avatar_emoji, avg_score, time_good_pct }) => `
    <div class="lb-row" style="${user_id === myUserId ? 'background:rgba(52,152,219,0.08);border-radius:8px;padding:10px 6px;' : ''}">
      <span class="lb-rank">${RANK_EMOJI[rank - 1] ?? rank}</span>
      <span class="lb-avatar">${avatar_emoji ?? '🧑'}</span>
      <span class="lb-name">${display_name}${user_id === myUserId ? ' <span style="font-size:10px;opacity:.5">(나)</span>' : ''}</span>
      <span>
        <div class="lb-score">${avg_score ?? '--'}점</div>
        <div class="lb-good">좋은자세 ${time_good_pct ?? 0}%</div>
      </span>
    </div>
  `).join('') || '<p style="opacity:.4;font-size:13px;text-align:center;padding:20px">데이터 없음</p>';
}
