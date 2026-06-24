// /감사 슬래시 명령어
// ※ 구매로그.js에 저장된 티켓 양식 정보를 가져와서, 감사 메시지에
//   "📋 구매로그 작성" 버튼을 함께 붙입니다. (티켓 열릴 때 자동으로 보내던 버튼을
//   이제는 /감사 실행 시점에 보내도록 변경)

const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const { isAllowed, replyNoPermission } = require('../lib/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('감사')
    .setDescription('구매 감사 메시지를 전송합니다.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) // 관리자만 사용 가능
    .addUserOption(option =>
      option
        .setName('유저')
        .setDescription('멘션할 유저를 선택하세요')
        .setRequired(true)
    ),

  async execute(interaction) {
    // 이중 안전장치: 관리자 OR 특별 허용 유저(ALLOWED_USER_IDS)만 사용 가능
    if (!isAllowed(interaction)) return replyNoPermission(interaction);

    const user = interaction.options.getUser('유저');

    const message = `${user}
<a:1574rainbowheart:1516382154618310776> 구매해주셔서 감사드립니다. <a:1574rainbowheart:1516382154618310776> 
<a:2bow:1516614678262972536> 친구들한테 서버 추천 해주시면 감사하겠습니다. <a:2bow:1516614678262972536>
<a:2MYaowlcatHeart:1515199465777139783> 다음에도 저희 서버 이용 부탁드려요. <a:2MYaowlcatHeart:1515199465777139783>
<a:5PikaStab:1516614149726011574> 좋은 하루 보내세요~ <a:5PikaStab:1516614149726011574>
" <a:emoji_380:1516614686148133018> <#1508378470273781820> <a:emoji_380:1516614686148133018>`;

    // 구매로그.js에 저장되어 있던 이 채널의 티켓 양식 정보를 가져옴
    // (티켓이 열릴 때 자동으로 파싱되어 저장된 닉네임/게임/로벅스 수량/구매자ID)
    let components = [];
    try {
      const purchaseLogCommand = interaction.client.commands?.get('구매로그');
      const formData = purchaseLogCommand?.getTicketFormData?.(interaction.channel.id);

      if (formData && purchaseLogCommand?.encodeFormState) {
        // 구매자가 자동으로 안 잡혔으면, 지금 /감사에서 선택한 유저를 구매자로 사용
        const buyerId = formData.buyerId || user.id;

        const button = new ButtonBuilder()
          .setCustomId(purchaseLogCommand.encodeFormState({
            messageId: formData.messageId,
            buyerId,
            nickname: formData.nickname,
            game: formData.game,
            robux: formData.robux,
            gamepass: formData.gamepass || null,
          }))
          .setLabel('📋 구매로그 작성')
          .setStyle(ButtonStyle.Success);

        components = [new ActionRowBuilder().addComponents(button)];
      } else {
        console.log(`⚠️ [감사] 채널 ${interaction.channel.id}에 저장된 티켓 양식 정보가 없어서 구매로그 버튼을 달지 못했어요.`);
      }
    } catch (err) {
      console.error('❌ [감사] 구매로그 버튼 생성 중 오류:', err);
    }

    await interaction.reply({ content: message, components });

    // 명령어를 사용한 채널 이름을 'ㅇㄹ'로 변경
    try {
      await interaction.channel.setName('ㅇㄹ', '/감사 명령어 실행으로 채널명 변경');
    } catch (err) {
      console.error('❌ 채널 이름 변경 실패:', err.message);
    }
  },
};
