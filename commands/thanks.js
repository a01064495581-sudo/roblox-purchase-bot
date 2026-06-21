// /감사 슬래시 명령어
// ※ 이 파일은 독립된 파일입니다. 다른 기능을 건드리지 않습니다.

const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('감사')
    .setDescription('구매 감사 메시지를 전송합니다.')
    .addUserOption(option =>
      option
        .setName('유저')
        .setDescription('멘션할 유저를 선택하세요')
        .setRequired(true)
    ),

  async execute(interaction) {
    const user = interaction.options.getUser('유저');

    const message = `${user}
<a:2bow:1451284074734817320> 구매해주셔서 감사드립니다. <a:2bow:1451284074734817320>
<a:2bow:1516614678262972536> 친구들한테 서버 추천 해주시면 감사하겠습니다. <a:2bow:1516614678262972536>
<a:2MYaowlcatHeart:1515199465777139783> 다음에도 저희 서버 이용 부탁드려요. <a:2MYaowlcatHeart:1515199465777139783>
<a:5PikaStab:1516614149726011574> 좋은 하루 보내세요~ <a:5PikaStab:1516614149726011574>
" <a:emoji_380:1516614686148133018> <#1508378470273781820> <a:emoji_380:1516614686148133018>`;

    await interaction.reply({ content: message });
  },
};
