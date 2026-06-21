// 범프 리마인더 기능
// ※ 이 파일은 독립된 파일입니다. 다른 기능을 건드리지 않습니다.

const BUMP_CHANNEL_ID = '1515618318113964084';
const BUMP_INTERVAL_MS = 2 * 60 * 60 * 1000; // 2시간

function startBumpReminder(client) {
  setInterval(async () => {
    try {
      const channel = await client.channels.fetch(BUMP_CHANNEL_ID);
      if (!channel) return console.warn('⚠️ 범프 채널을 찾을 수 없어요.');
      await channel.send('@everyone 🔔 디스보드 `/bump` 할 시간이에요!');
    } catch (err) {
      console.error('❌ 범프 리마인더 오류:', err);
    }
  }, BUMP_INTERVAL_MS);

  console.log('⏰ 범프 리마인더가 시작됐어요. (2시간마다 알림)');
}

module.exports = { startBumpReminder };
