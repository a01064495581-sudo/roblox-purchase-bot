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

// 구매로그.js와 동일한 로블록스 API 함수
async function getRobloxUser(username) {
  try {
    const res = await fetch('https://users.roblox.com/v1/usernames/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usernames: [username], excludeBannedUsers: false }),
    });
    const data = await res.json();
    if (!data.data || data.data.length === 0) return null;
    return data.data[0];
  } catch (err) {
    console.error('로블록스 유저 조회 실패:', err);
    return null;
  }
}

async function getRobloxAvatar(userId) {
  try {
    const res = await fetch(
      `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=180x180&format=Png&isCircular=false`
    );
    const data = await res.json();
    if (!data.data || data.data.length === 0) return null;
    return data.data[0].imageUrl;
  } catch (err) {
    console.error('로블록스 아바타 조회 실패:', err);
    return null;
  }
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

    // 로블록스 프로필 조회
    const robloxUser = await getRobloxUser(parsed.nickname);
    let avatarUrl = null;
    let robloxProfileUrl = null;

    if (robloxUser) {
      robloxProfileUrl = `https://www.roblox.com/users/${robloxUser.id}/profile`;
      avatarUrl = await getRobloxAvatar(robloxUser.id);
    }

    // 닉네임 필드값: 프로필 링크 있으면 하이퍼링크로, 없으면 그냥 텍스트
    const nicknameValue = robloxProfileUrl
      ? `[${parsed.nickname}](${robloxProfileUrl})`
      : parsed.nickname;

    const embed = new EmbedBuilder()
      .setColor(0xF1C40F)
      .setTitle('구매 안내')
      .addFields(
        { name: '구매 로벅스',       value: `${parsed.robux.toLocaleString('ko-KR')} R$`, inline: false },
        { name: '\u200b',            value: '\u200b', inline: false },
        { name: '로블록스 닉네임',   value: nicknameValue, inline: false },
        { name: '\u200b',            value: '\u200b', inline: false },
        { name: '구매하실 게임',     value: parsed.game, inline: false },
        { name: '\u200b',            value: '\u200b', inline: false },
        { name: '구매하실 게임패스', value: parsed.gamepass, inline: false },
        { name: '\u200b',            value: '\u200b', inline: false },
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

    // 아바타 이미지 있으면 썸네일로 설정
    if (avatarUrl) embed.setThumbnail(avatarUrl);

    await interaction.channel.send({
      content: parsed.buyer ? `${parsed.buyer}` : undefined,
      embeds: [embed],
    });
    await interaction.editReply({ content: '✅ 안내 임베드를 전송했어요!' });
  },
};
