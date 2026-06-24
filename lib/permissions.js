// lib/permissions.js
// 관리자 권한 또는 특정 허용 유저 ID 목록을 확인하는 공통 유틸
//
// ✅ 사용법: .env 파일에 아래처럼 추가하세요 (유저 ID 여러 명이면 쉼표로 구분)
//   ALLOWED_USER_IDS=123456789012345678,987654321098765432

const { PermissionFlagsBits } = require('discord.js');

/**
 * interaction을 보낸 유저가 명령어를 사용할 수 있는지 확인합니다.
 * - 서버 관리자(Administrator) 권한이 있으면 허용
 * - 환경변수 ALLOWED_USER_IDS에 포함된 유저 ID이면 허용
 *
 * @param {import('discord.js').Interaction} interaction
 * @returns {boolean}
 */
function isAllowed(interaction) {
  // 1) 관리자 권한 체크
  if (interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    return true;
  }

  // 2) 특별 허용 유저 ID 체크 (.env의 ALLOWED_USER_IDS)
  const allowedIds = (process.env.ALLOWED_USER_IDS || '')
    .split(',')
    .map(id => id.trim())
    .filter(Boolean);

  if (allowedIds.includes(interaction.user.id)) {
    return true;
  }

  return false;
}

/**
 * 권한이 없을 때 에러 메시지를 보냅니다.
 * @param {import('discord.js').Interaction} interaction
 */
async function replyNoPermission(interaction) {
  const reply = {
    content: '🚫 이 명령어는 관리자 권한을 가진 멤버만 사용할 수 있어요.',
    ephemeral: true,
  };
  if (interaction.replied || interaction.deferred) {
    await interaction.followUp(reply).catch(() => {});
  } else {
    await interaction.reply(reply).catch(() => {});
  }
}

module.exports = { isAllowed, replyNoPermission };
