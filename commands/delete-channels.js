// delete-channels.js
// ※ 이 파일은 다른 기능과 완전히 독립된 파일입니다.
// 이름이 정확히 'ㅇㄹ'인 채널을 찾아 목록을 보여주고,
// 관리자가 확인 버튼을 눌렀을 때만 실제로 삭제합니다.

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const { isAllowed, replyNoPermission } = require('../lib/permissions');

const TARGET_CHANNEL_NAME = 'ㅇㄹ';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('삭제')
    .setDescription('이름이 정확히 "ㅇㄹ"인 채널을 모두 삭제합니다 (관리자 전용)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    // 이중 안전장치: 관리자 OR 특별 허용 유저(ALLOWED_USER_IDS)만 사용 가능
    if (!isAllowed(interaction)) return replyNoPermission(interaction);

    // 이름이 정확히 'ㅇㄹ'인 채널 목록 수집
    const targetChannels = interaction.guild.channels.cache.filter(
      ch => ch.name === TARGET_CHANNEL_NAME
    );

    if (targetChannels.size === 0) {
      return interaction.reply({
        content: `✅ 이름이 정확히 \`${TARGET_CHANNEL_NAME}\`인 채널이 없어요. 삭제할 채널이 없습니다.`,
        ephemeral: true,
      });
    }

    // 삭제 대상 채널 목록 텍스트로 정리
    const channelList = targetChannels
      .map(ch => `• ${ch} (ID: \`${ch.id}\`)`)
      .join('\n');

    // 확인/취소 버튼
    const confirmBtn = new ButtonBuilder()
      .setCustomId('delete_channels_confirm')
      .setLabel(`🗑️ ${targetChannels.size}개 채널 삭제 확인`)
      .setStyle(ButtonStyle.Danger);

    const cancelBtn = new ButtonBuilder()
      .setCustomId('delete_channels_cancel')
      .setLabel('취소')
      .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder().addComponents(confirmBtn, cancelBtn);

    return interaction.reply({
      content: `⚠️ **삭제 확인**\n아래 채널 **${targetChannels.size}개**를 삭제하려고 합니다. 정말 삭제할까요?\n\n${channelList}\n\n삭제하면 **되돌릴 수 없습니다.**`,
      components: [row],
      ephemeral: true,
    });
  },

  // index.js의 interactionCreate에서 호출
  async handleDeleteComponent(interaction) {
    // 삭제 확인 버튼
    if (interaction.isButton() && interaction.customId === 'delete_channels_confirm') {
      if (!isAllowed(interaction)) return replyNoPermission(interaction);

      await interaction.deferUpdate();

      // 버튼 누른 시점에 다시 채널 목록 수집 (혹시 그 사이 변경됐을 경우 대비)
      const targetChannels = interaction.guild.channels.cache.filter(
        ch => ch.name === TARGET_CHANNEL_NAME
      );

      if (targetChannels.size === 0) {
        return interaction.editReply({
          content: '✅ 삭제할 채널이 이미 없어요.',
          components: [],
        });
      }

      // 실제 삭제 실행
      let deletedCount = 0;
      const failedChannels = [];

      for (const [, ch] of targetChannels) {
        try {
          await ch.delete(`/삭제 명령어 실행 by ${interaction.user.tag}`);
          deletedCount++;
        } catch (err) {
          console.error(`채널 삭제 실패 (${ch.name} / ${ch.id}):`, err.message);
          failedChannels.push(`• ${ch.name} (\`${ch.id}\`)`);
        }
      }

      let resultMsg = `✅ **${deletedCount}개 채널 삭제 완료**`;
      if (failedChannels.length > 0) {
        resultMsg += `\n\n⚠️ 삭제 실패한 채널 (권한 문제일 수 있어요):\n${failedChannels.join('\n')}`;
      }

      return interaction.editReply({
        content: resultMsg,
        components: [],
      });
    }

    // 취소 버튼
    if (interaction.isButton() && interaction.customId === 'delete_channels_cancel') {
      return interaction.update({
        content: '❌ 삭제가 취소되었어요.',
        components: [],
      });
    }
  },
};
