// auto-react.js
// ※ 이 파일은 다른 기능과 완전히 독립된 파일입니다.
// 특정 채널에서 사람이 보낸 메시지에 자동으로 이모지 반응을 답니다.

// ─────────────────────────────────────────
// 설정 (여기만 수정하면 됨)
// ─────────────────────────────────────────

// 이모지를 달 채널 ID
const TARGET_CHANNEL_ID = '1508378470273781820';

// 달아줄 커스텀 이모지 (애니메이션 이모지)
const REACT_EMOJI = '1574rainbowheart:1516382154618310776';

// ─────────────────────────────────────────
// 메인 함수 (index.js의 messageCreate에서 호출)
// ─────────────────────────────────────────
async function handleAutoReact(message) {
  // 대상 채널이 아니면 무시
  if (message.channel.id !== TARGET_CHANNEL_ID) return;

  // 봇이 보낸 메시지는 무시 (사람만)
  if (message.author.bot) return;

  try {
    await message.react(REACT_EMOJI);
  } catch (err) {
    console.error('❌ 자동 이모지 반응 실패:', err.message);
  }
}

module.exports = { handleAutoReact };
