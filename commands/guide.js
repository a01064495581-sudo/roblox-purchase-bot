// /안내 슬래시 명령어
// ※ 이 파일은 독립된 파일입니다. 다른 기능을 건드리지 않습니다.

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
} = require('discord.js');
const { isAllowed, replyNoPermission } = require('../lib/permissions');
const {
  buildGuideEmbed,
  fetchRobloxProfile,
} = require('../lib/account-select');

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

    // 이 메시지(또는 같은 채널의 다른 봇 메시지)에 멘션된 유저를 구매자로 추정
    // 안내 임베드 메시지에 보통 "@닉네임 님의 티켓을..." 형태로 구매자가 멘션되어 있음
    let buyer = message.mentions?.users?.first() || null;
    if (!buyer) {
      // 이 메시지 자체에 멘션이 없으면, 같이 순회 중인 다른 메시지에서도 찾아봄
      for (const other of messages.values()) {
        const otherMention = other.mentions?.users?.first();
        if (otherMention) {
          buyer = otherMention;
          break;
        }
      }
    }

    return { robux, nickname, game, gamepass, buyer };
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
    if (!isAllowed(interaction)) return replyNoPermission(interaction);

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

    // 로블록스 프로필 조회 (실패해도 안내 전송은 계속 진행)
    const { profileUrl, avatarUrl } = await fetchRobloxProfile(parsed.nickname);

    const embed = buildGuideEmbed({
      robux: parsed.robux,
      nickname: parsed.nickname,
      game: parsed.game,
      gamepass: parsed.gamepass,
      accountIndex: accIdx,
      avatarUrl,
      nicknameProfileUrl: profileUrl,
    });

    await interaction.channel.send({
      content: parsed.buyer ? `${parsed.buyer}` : undefined,
      embeds: [embed],
    });
    await interaction.editReply({ content: '✅ 안내 임베드를 전송했어요!' });
  },
};
