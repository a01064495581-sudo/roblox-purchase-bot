// lib/night-lockdown.js
// 한국시간(KST) 오전 2시 ~ 오전 7시 사이, 지정된 채널들에서
// 특정 역할(애벌레)의 "메시지 보내기" 권한을 자동으로 끄고 켭니다.
//
// .env 에 아래 항목을 추가하세요:
//
//   NIGHT_LOCK_ROLE_ID=애벌레역할ID
//   NIGHT_LOCK_CHANNEL_IDS=채널ID1,채널ID2,채널ID3,채널ID4,채널ID5,채널ID6
//
// 동작 방식:
//   - 1분마다 현재 KST 시각을 확인
//   - 02:00 ~ 06:59 사이면 → 메시지 보내기 권한 OFF (잠금)
//   - 그 외 시간이면 → 권한 명시적 허용도 OFF, 즉 권한 오버라이트 자체를 제거(기본값 복귀)
//   - 매 분 체크하지만, 실제로 "잠금 시작 시각(02:00)"과 "잠금 해제 시각(07:00)"
//     경계를 지났을 때만 1회 실행되도록 상태를 기억해서 중복 호출을 막음

const { PermissionsBitField } = require('discord.js');

const LOCK_START_HOUR = 2; // 02:00 KST 부터 잠금
const LOCK_END_HOUR   = 7; // 07:00 KST 에 잠금 해제

let lastState = null; // 'locked' | 'unlocked' | null (초기값)
let intervalHandle = null;

// ── 현재 KST 시각의 "시(hour)" 가져오기 ──
function getKstHour() {
  const kstString = new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' });
  return new Date(kstString).getHours();
}

// ── 현재 잠금 여부 판단 ──
function shouldBeLocked() {
  const hour = getKstHour();
  // 02:00 ~ 06:59 → true (잠금)
  return hour >= LOCK_START_HOUR && hour < LOCK_END_HOUR;
}

// ── 잠금 안내 메시지 전송 ──
async function sendLockAnnouncement(client, channelIds) {
  const message =
    '🚨 **많은 서버에서 테러를 당해 일정기간동안 테러방지를 위해 모든채널이 잠깁니다**\n' +
    '🕑 **매일 새벽 2시 ~ 아침 7시**';

  for (const channelId of channelIds) {
    try {
      const channel = await client.channels.fetch(channelId);
      if (!channel) continue;
      await channel.send({ content: message });
    } catch (err) {
      console.error(`❌ [야간잠금] 채널 ${channelId} 안내 메시지 전송 실패:`, err.message);
    }
  }
}

// ── 채널들에 권한 적용 ──
async function applyLockState(client, locked) {
  const roleId     = process.env.NIGHT_LOCK_ROLE_ID;
  const channelIdsRaw = process.env.NIGHT_LOCK_CHANNEL_IDS;

  if (!roleId) {
    console.warn('⚠️ [야간잠금] NIGHT_LOCK_ROLE_ID가 설정되지 않았어요.');
    return;
  }
  if (!channelIdsRaw) {
    console.warn('⚠️ [야간잠금] NIGHT_LOCK_CHANNEL_IDS가 설정되지 않았어요.');
    return;
  }

  const channelIds = channelIdsRaw.split(',').map(id => id.trim()).filter(Boolean);

  for (const channelId of channelIds) {
    try {
      const channel = await client.channels.fetch(channelId);
      if (!channel) {
        console.warn(`⚠️ [야간잠금] 채널을 찾을 수 없어요: ${channelId}`);
        continue;
      }

      if (locked) {
        // 메시지 보내기 권한 OFF (명시적 차단)
        await channel.permissionOverwrites.edit(roleId, {
          SendMessages: false,
        });
      } else {
        // 잠금 해제: 메시지 보내기 권한 명시적으로 허용 (✅)
        await channel.permissionOverwrites.edit(roleId, {
          SendMessages: true,
        });
      }
    } catch (err) {
      console.error(`❌ [야간잠금] 채널 ${channelId} 권한 변경 실패:`, err.message);
    }
  }

  console.log(
    locked
      ? `🌙 [야간잠금] ${channelIds.length}개 채널에서 애벌레 역할 메시지 권한을 잠갔어요. (KST 02:00~07:00)`
      : `☀️ [야간잠금] ${channelIds.length}개 채널에서 애벌레 역할 메시지 권한을 해제했어요.`
  );

  // 잠금이 "새로 시작"될 때만 안내 메시지 전송 (해제될 때는 전송 안 함)
  if (locked) {
    await sendLockAnnouncement(client, channelIds);
  }
}

// ── 1분마다 체크 ──
function startNightLockdown(client) {
  if (intervalHandle) return; // 중복 시작 방지

  const check = async () => {
    const locked = shouldBeLocked();
    const targetState = locked ? 'locked' : 'unlocked';

    // 상태가 바뀐 경우에만 실행 (매분 중복 API 호출 방지)
    if (targetState !== lastState) {
      lastState = targetState;
      await applyLockState(client, locked);
    }
  };

  // 봇 시작 시 현재 시각 기준으로 1회 즉시 적용
  check();

  // 이후 1분마다 체크
  intervalHandle = setInterval(check, 60 * 1000);

  console.log('🌙 [야간잠금] 스케줄러 시작됨 (KST 02:00~07:00 자동 잠금)');
}

function stopNightLockdown() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    lastState = null;
  }
}

module.exports = { startNightLockdown, stopNightLockdown };
