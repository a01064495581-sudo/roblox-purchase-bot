// 범프 리마인더 기능
// ※ 이 파일은 독립된 파일입니다. 다른 기능을 건드리지 않습니다.

const BUMP_CHANNEL_ID = '1515618318113964084';
const BUMP_INTERVAL_MS = 2 * 60 * 60 * 1000; // 2시간

let bumpTimer = null;

function startBumpReminder(client) {
  client.on('messageCreate', async (message) => {
    // Disboard 봇만 감지 (ID: 302050872383242240)
    if (!message.author.bot) return;
    if (message.author.id !== '302050872383242240') return;

    // 범프 완료 메시지 감지 (임베드 description에 "Bump done" 포함)
    const isBumpDone = message.embeds?.some(embed =>
      embed.description?.includes('Bump done') ||
      embed.description?.includes('bump done') ||
      embed.description?.includes('범프')
    );
    if (!isBumpDone) return;

    console.log('✅ 범프 감지! 2시간 후 알림 예약됨.');

    // 기존 타이머 있으면 초기화하고 새로 시작
    if (bumpTimer) clearTimeout(bumpTimer);

    bumpTimer = setTimeout(async () => {
      try {
        const channel = await client.channels.fetch(BUMP_CHANNEL_ID);
        if (!channel) return console.warn('⚠️ 범프 채널을 찾을 수 없어요.');
        await channel.send('@everyone 🔔 `/bump` 할 시간이에요! 디스보드에서 범프해주세요~');
      } catch (err) {
        console.error('❌ 범프 리마인더 오류:', err);
      }
    }, BUMP_INTERVAL_MS);
  });

  console.log('⏰ 범프 리마인더 대기 중... (범프 감지 후 2시간 뒤 알림)');
}

module.exports = { startBumpReminder };
