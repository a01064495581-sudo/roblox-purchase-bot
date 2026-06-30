// lib/night-slowmode.js
// 한국시간(KST) 오전 2시 ~ 오전 7시 사이, 지정된 채널들에
// 슬로우모드(쿨다운) 6시간을 자동으로 걸고, 7시가 되면 다시 0초(없음)로 되돌립니다.
//
// .env 에 아래 항목을 추가하세요:
//
//   NIGHT_SLOWMODE_CHANNEL_IDS=채널ID1,채널ID2
//
// 동작 방식:
//   - 1분마다 현재 KST 시각을 확인
//   - 02:00 ~ 06:59 사이면 → 슬로우모드 6시간(21600초)으로 설정
//   - 그 외 시간이면 → 슬로우모드 0초(없음)로 해제
//   - night-lockdown.js와 동일하게, 상태가 바뀌는 경계(02:00, 07:00)를
//     지났을 때만 1회 실행되도록 해서 중복 API 호출을 막음

const LOCK_START_HOUR = 2; // 02:00 KST 부터 슬로우모드 시작
const LOCK_END_HOUR   = 7; // 07:00 KST 에 슬로우모드 해제

const SLOWMODE_SECONDS_ON  = 6 * 60 * 60; // 6시간 = 21600초
const SLOWMODE_SECONDS_OFF = 0;           // 쿨다운 없음

let lastState = null; // 'locked' | 'unlocked' | null
let intervalHandle = null;

// ── 현재 KST 시각의 "시(hour)" 가져오기 ──
function getKstHour() {
  const kstString = new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' });
  return new Date(kstString).getHours();
}

function shouldBeLocked() {
  const hour = getKstHour();
  return hour >= LOCK_START_HOUR && hour < LOCK_END_HOUR;
}

// ── 채널들에 슬로우모드 적용 ──
async function applySlowmodeState(client, locked) {
  const channelIdsRaw = process.env.NIGHT_SLOWMODE_CHANNEL_IDS;

  if (!channelIdsRaw) {
    console.warn('⚠️ [야간슬로우모드] NIGHT_SLOWMODE_CHANNEL_IDS가 설정되지 않았어요.');
    return;
  }

  const channelIds = channelIdsRaw.split(',').map(id => id.trim()).filter(Boolean);
  const seconds = locked ? SLOWMODE_SECONDS_ON : SLOWMODE_SECONDS_OFF;

  for (const channelId of channelIds) {
    try {
      const channel = await client.channels.fetch(channelId);
      if (!channel) {
        console.warn(`⚠️ [야간슬로우모드] 채널을 찾을 수 없어요: ${channelId}`);
        continue;
      }
      await channel.setRateLimitPerUser(seconds);
    } catch (err) {
      console.error(`❌ [야간슬로우모드] 채널 ${channelId} 슬로우모드 변경 실패:`, err.message);
    }
  }

  console.log(
    locked
      ? `🐢 [야간슬로우모드] ${channelIds.length}개 채널에 슬로우모드 6시간을 설정했어요. (KST 02:00~07:00)`
      : `⚡ [야간슬로우모드] ${channelIds.length}개 채널의 슬로우모드를 해제했어요. (쿨다운 없음)`
  );
}

// ── 1분마다 체크 ──
function startNightSlowmode(client) {
  if (intervalHandle) return; // 중복 시작 방지

  const check = async () => {
    const locked = shouldBeLocked();
    const targetState = locked ? 'locked' : 'unlocked';

    if (targetState !== lastState) {
      lastState = targetState;
      await applySlowmodeState(client, locked);
    }
  };

  // 봇 시작 시 현재 시각 기준으로 1회 즉시 적용
  check();

  // 이후 1분마다 체크
  intervalHandle = setInterval(check, 60 * 1000);

  console.log('🐢 [야간슬로우모드] 스케줄러 시작됨 (KST 02:00~07:00 자동 슬로우모드 6시간)');
}

function stopNightSlowmode() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    lastState = null;
  }
}

module.exports = { startNightSlowmode, stopNightSlowmode };
