// /안내 슬래시 명령어
// ※ 이 파일은 독립된 파일입니다. 다른 기능을 건드리지 않습니다.

const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} = require('discord.js');

// GIF URL
const GIF_URL = 'https://cdn.discordapp.com/attachments/1388285653640282246/1517608996230397982/1.gif?ex=6a3a32c4&is=6a38e144&hm=b199bc601081c42bbf42e04bcaec62e2b7cf64209c2b28ae5245768556716e8a&';

// 계좌 정보
const ACCOUNTS = [
  { name: '박양봉', bank: '토스뱅크', number: '1001-6192-9770', holder: '박제영' },
  { name: '김양봉', bank: '토스뱅크', number: '1002-1293-2074', holder: '김부성' },
  { name: '오리',   bank: '토스뱅크', number: '1000-8188-8025', holder: '유민성' },
];

// 1만원당 1400로벅스 기준 가격 계산
function calculatePrice(robux) {
  const won = Math.round(robux * (10000 / 1400));
  return won.toLocaleString('ko-KR') + '원';
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractValue(fullText, labelCandidates, negativeLookaheadAfter = []) {
  for (const label of labelCandidates) {
    const negativeLookahead = negativeLookaheadAfter
      .map(s => `(?!${escapeRegex(s)})`)
      .join('');
    const pattern = new RegExp(
      `\\*\\*\\s*${escapeRegex(label)}${negativeLookahead}\\s*\\*\\*\\s*` + '```([\\s\\S]*?)```',
      'g'
    );
    const match = pattern.exec(fullText);
    if (match) {
      const value = match[1].trim();
      if (value) return value;
    }
  }
  return null;
}

function parseTicketFormFromChannel(messages) {
  for (const message of messages.values()) {
    if (!message.author?.bot) continue;
    if (!message.embeds || message.embeds.length === 0) continue;

    const fullText = message.embeds
      .map(embed => embed.description || '')
      .join('\n');

    if (!fullText.trim()) continue;

    const robuxText = extractValue(fullText, ['로벅스 구매 수량', '구매 수량', '로벅스 수량']);
    const nickname  = extractValue(fullText, ['로블록스 닉네임', '닉네임']);
    const game      = extractValue(fullText, ['구매하실 게임', '게임 이름', '게임'], ['패스']);
    const gamepass  = extractValue(fullText, ['구매하실 게임패스', '게임패스']);

    if (!robuxText || !nickname || !game || !gamepass) continue;

    const robuxMatch = robuxText.match(/[\d,]+/);
    if (!robuxMatch) continue;
    const robux = Number(robuxMatch[0].replace(/,/g, ''));
    if (!robux || Number.isNaN(robux)) continue;

    return { robux, nickname, game, gamepass };
  }
  return null;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('안내')
    .setDescription('티켓 양식을 읽어 구매 안내 임베드를 전송합니다. (관리자 전용)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option =>
      option.setName('계좌')
        .setDescription('입금 계좌 선택')
        .setRequired(true)
        .addChoices(
          { name: '박양봉 (토스뱅크 1001-6192-9770)', value: '0' },
          { name: '김양봉 (토스뱅크 1002-1293-2074)', value: '1' },
          { name: '오리 (토스뱅크 1000-8188-8025)',   value: '2' },
        )
    ),

  async execute(interaction) {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({
        content: '🚫 이 명령어는 관리자 권한을 가진 멤버만 사용할 수 있어요.',
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });

    let messages;
    try {
      messages = await interaction.channel.messages.fetch({ limit: 20 });
    } catch (err) {
      return interaction.editReply({ content: '⚠️ 채널 메시지를 읽지 못했어요.' });
    }

    const parsed = parseTicketFormFromChannel(messages);
    if (!parsed) {
      return interaction.editReply({
        content: '⚠️ 이 채널에서 티켓 양식을 찾지 못했어요. 티켓 채널에서 사용해주세요.',
      });
    }

    const accIdx = Number(interaction.options.getString('계좌'));
    const acc    = ACCOUNTS[accIdx];
    const price  = calculatePrice(parsed.robux);

    const embed = new EmbedBuilder()
      .setColor(0xF1C40F)
      .setTitle('구매 안내')
      .addFields(
        { name: '구매 로벅스',      value: `${parsed.robux.toLocaleString('ko-KR')} R$`, inline: true },
        { name: '로블록스 닉네임',  value: parsed.nickname, inline: true },
        { name: '\u200b',           value: '\u200b',         inline: false },
        { name: '구매하실 게임',    value: parsed.game,     inline: true },
        { name: '구매하실 게임패스', value: parsed.gamepass, inline: true },
        { name: '\u200b',           value: '\u200b',         inline: false },
        {
          name: '입금 안내',
          value: `**${price}**을 아래 계좌로 입금해 주세요.\n\n${acc.bank} \`${acc.number}\` : **${acc.holder}**`,
          inline: false,
        },
        { name: '\u200b', value: '\u200b', inline: false },
        {
          name: '이중창 인증 필수',
          value: '**이중창이 뭔가요?** <#1508377099847864402> 를 확인하세요.',
          inline: false,
        },
        { name: '\u200b', value: '\u200b', inline: false },
        {
          name: '\u200b',
          value: '*(10,000원당 1,400로벅스 기준)*',
          inline: false,
        },
      )
      .setImage(GIF_URL)
      .setTimestamp();

    await interaction.channel.send({ embeds: [embed] });
    await interaction.editReply({ content: '✅ 안내 임베드를 전송했어요!' });
  },
};
