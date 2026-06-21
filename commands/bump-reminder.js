// /bump 리마인더 기능
// Disboard 봇(/bump 명령어 제공)이 "bump 성공" 메시지를 보내면 자동으로 감지해서
// 2시간 후 같은 채널에 특정 역할을 멘션하며 "이제 bump 가능해요!" 알림을 보냅니다.
//
// index.js의 messageCreate 이벤트에서 checkBumpMessage(message)를 호출해주세요.

// Disboard 공식 봇의 디스코드 유저 ID (고정값, 모든 서버에서 동일)
const DISBOARD_BOT_ID = '302050872383242240';

// 2시간 후 알림을 보낼 때 멘션할 역할 ID
// TODO: 실제 @관리자 역할 ID로 교체해주세요.
// (서버 설정 > 역할 > 해당 역할 길게 누르기/우클릭 > "ID 복사")
const REMINDER_ROLE_ID = '1501703616162169033';

// bump 쿨다운 시간 (2시간 = 밀리초)
const BUMP_COOLDOWN_MS = 2 * 60 * 60 * 1000;

// 채널별로 이미 예약된 타이머를 추적 (중복 알림 방지용)
// 같은 채널에서 짧은 시간 안에 bump 메시지가 여러 번 잡히는 경우를 대비
const activeTimers = new Map(); // channelId -> Timeout

// Disboard의 "bump 성공" 임베드인지 확인
// Disboard는 보통 description에 "Bump done!" 또는 한국어 서버 설정 시 유사한 성공 문구를 담아 보냅니다.
function isBumpSuccessMessage(message) {
  if (message.author.id !== DISBOARD_BOT_ID) return false;
  if (message.embeds.length === 0) return false;

  const text = message.embeds
    .map(embed => `${embed.title || ''} ${embed.description || ''}`)
    .join(' ')
    .toLowerCase();

  // Disboard 성공 메시지에 흔히 들어가는 키워드들
  // (영문/한글 서버 설정 둘 다 대비)
  return (
    text.includes('bump done') ||
    text.includes('bump 완료') ||
    text.includes('서버가 부') || // "서버가 부스트되었습니다" 등
    text.includes('성공적으로')
  );
}

module.exports = {
  // index.js의 messageCreate 이벤트에서 호출
  async checkBumpMessage(message) {
    if (!isBumpSuccessMessage(message)) return;

    console.log(`✅ [bump 감지] 채널 ${message.channel.id}에서 bump 성공 메시지 감지! 2시간 타이머 시작.`);

    const channelId = message.channel.id;

    // 같은 채널에 이미 걸려있는 타이머가 있으면 취소 (중복 알림 방지)
    if (activeTimers.has(channelId)) {
      clearTimeout(activeTimers.get(channelId));
    }

    const timer = setTimeout(async () => {
      try {
        const roleMention = REMINDER_ROLE_ID.startsWith('여기에')
          ? '@관리자 (⚠️ REMINDER_ROLE_ID를 코드에서 실제 역할 ID로 바꿔주세요)'
          : `<@&${REMINDER_ROLE_ID}>`;

        await message.channel.send({
          content: `${roleMention} ⏰ 지금 \`/bump\` 가능해요! 서버를 다시 부스트해주세요.`,
        });
        console.log(`🔔 [bump 알림] 채널 ${channelId}에 리마인더 전송 완료.`);
      } catch (err) {
        console.error('❌ bump 리마인더 전송 중 오류:', err);
      } finally {
        activeTimers.delete(channelId);
      }
    }, BUMP_COOLDOWN_MS);

    activeTimers.set(channelId, timer);
  },
};
