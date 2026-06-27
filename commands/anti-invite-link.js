// anti-invite-link.js
// ※ 이 파일은 다른 기능과 완전히 독립된 파일입니다.
// 디스코드 초대 링크(discord.gg, discord.com/invite, discordapp.com/invite 등)가
// 포함된 메시지를 모든 채널에서 자동으로 감지해서 삭제합니다.
// (계정 해킹/탈취로 야동·홍보 서버 초대 링크가 뿌려지는 상황 대응용)

const { PermissionFlagsBits } = require('discord.js');

// ─────────────────────────────────────────
// 설정 (여기만 수정하면 됨)
// ─────────────────────────────────────────

// 관리자(Administrator 권한 보유자)가 보낸 메시지는 검사하지 않음
// → 공지/안내 등으로 관리자가 직접 초대 링크를 올리는 경우는 막지 않기 위함
const IGNORE_ADMINS = true;

// 삭제 후 채널에 남길 경고 메시지 (몇 초 후 자동 삭제됨). null이면 경고 메시지 없이 조용히 삭제만 함
const WARNING_TEXT = '🚫 디스코드 초대 링크가 감지되어 메시지를 삭제했어요.';
const WARNING_DELETE_AFTER_MS = 5000; // 5초 후 경고 메시지 자동 삭제

// 삭제 로그를 남길 채널 ID (선택사항). 비워두면(null) 콘솔에만 로그를 남김
const LOG_CHANNEL_ID = null; // 예: '1234567890123456789'

// 디스코드 초대 링크 패턴
//  - discord.gg/코드
//  - discord.com/invite/코드
//  - discordapp.com/invite/코드
//  - ptb.discord.com / canary.discord.com 변형도 포함
const INVITE_LINK_REGEX = /(https?:\/\/)?(www\.)?(ptb\.|canary\.)?(discord\.(gg|com\/invite|me)|discordapp\.com\/invite)\/[a-zA-Z0-9-]+/i;

// ─────────────────────────────────────────
// 메인 함수 (index.js의 messageCreate에서 호출)
// ─────────────────────────────────────────
async function handleAntiInviteLink(message) {
  // 봇이 보낸 메시지는 무시
  if (message.author.bot) return false;

  // DM 등 길드 메시지가 아니면 무시
  if (!message.guild) return false;

  const content = message.content || '';
  if (!INVITE_LINK_REGEX.test(content)) return false;

  // 관리자는 예외 처리
  if (IGNORE_ADMINS && message.member?.permissions?.has(PermissionFlagsBits.Administrator)) {
    return false;
  }

  try {
    await message.delete();
    console.log(`🚫 초대 링크 감지 → 메시지 삭제 (작성자: ${message.author.tag}, 채널: ${message.channel.id})`);

    // 채널에 짧은 경고 메시지 남기기
    if (WARNING_TEXT) {
      try {
        const warning = await message.channel.send(
          `${WARNING_TEXT} (작성자: <@${message.author.id}>)`
        );
        setTimeout(() => {
          warning.delete().catch(() => {});
        }, WARNING_DELETE_AFTER_MS);
      } catch (err) {
        console.error('❌ 경고 메시지 전송 실패:', err.message);
      }
    }

    // 별도 로그 채널에 기록
    if (LOG_CHANNEL_ID) {
      try {
        const logChannel = await message.guild.channels.fetch(LOG_CHANNEL_ID);
        if (logChannel?.isTextBased()) {
          await logChannel.send(
            `🚫 **초대 링크 자동 삭제**\n` +
            `> 작성자: <@${message.author.id}> (${message.author.tag})\n` +
            `> 채널: <#${message.channel.id}>\n` +
            `> 내용: \`${content.slice(0, 500)}\``
          );
        }
      } catch (err) {
        console.error('❌ 로그 채널 전송 실패:', err.message);
      }
    }
  } catch (err) {
    console.error('❌ 초대 링크 메시지 삭제 실패:', err.message);
  }

  return true;
}

module.exports = { handleAntiInviteLink };
