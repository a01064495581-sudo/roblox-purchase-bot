// 계좌 및 가격 안내 버튼 기능
// ※ 이 파일은 구매로그 기능과 완전히 독립된 파일입니다. 구매로그 코드를 건드리지 않습니다.

const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} = require('discord.js');

// ─────────────────────────────────────────
// 계좌 정보 (여기만 수정하면 됨)
// ─────────────────────────────────────────
const ACCOUNTS = [
  { name: '박제영', bank: '토스뱅크', number: '1001-6192-9770', holder: '박제영' },
  { name: '김부성', bank: '토스뱅크', number: '1002-1293-2074', holder: '김부성' },
  { name: '유민성', bank: '토스뱅크', number: '1000-8188-8025', holder: '유민성' },
];

// ─────────────────────────────────────────
// 티켓 양식에서 로벅스 수량 파싱 (구매로그와 동일한 방식)
// ─────────────────────────────────────────
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractRobux(message) {
  if (!message.embeds || message.embeds.length === 0) return null;

  const fullText = message.embeds
    .map(embed => embed.description || '')
    .join('\n');

  if (!fullText.trim()) return null;

  const labelCandidates = ['로벅스 구매 수량', '구매 수량', '로벅스 수량'];

  for (const label of labelCandidates) {
    const pattern = new RegExp(
      `\\*\\*\\s*${escapeRegex(label)}\\s*\\*\\*\\s*` + '```([\\s\\S]*?)```',
      'g'
    );
    const match = pattern.exec(fullText);
    if (match) {
      const robuxMatch = match[1].trim().match(/[\d,]+/);
      if (robuxMatch) {
        const robux = Number(robuxMatch[0].replace(/,/g, ''));
        if (robux && !Number.isNaN(robux)) return robux;
      }
    }
  }
  return null;
}

// 1만원당 1400로벅스 기준 가격 계산
function calculatePrice(robux) {
  const won = Math.round(robux * (10000 / 1400));
  return won.toLocaleString('ko-KR') + '원';
}

// ─────────────────────────────────────────
// 티켓 양식 메시지 감지 → 계좌/가격 버튼 부착
// (index.js의 handleTicketFormMessage 흐름과 별도로 동작)
// ─────────────────────────────────────────
async function handleTicketInfoButtons(message) {
  // 봇 메시지이고 임베드가 있을 때만 처리
  if (!message.author?.bot) return;
  if (!message.embeds || message.embeds.length === 0) return;

  // 로벅스 수량이 파싱되는 티켓 양식 메시지인지 확인
  const robux = extractRobux(message);
  if (!robux) return;

  // 이미 계좌/가격 버튼이 달린 메시지가 있으면 중복 방지
  // (같은 채널에서 봇이 보낸 최근 메시지 확인)
  try {
    const recent = await message.channel.messages.fetch({ limit: 10 });
    const alreadySent = recent.some(m =>
      m.author.id === message.client.user.id &&
      m.components?.length > 0 &&
      m.components[0]?.components?.some(c => c.customId?.startsWith('ticket_account') || c.customId?.startsWith('ticket_price'))
    );
    if (alreadySent) return;
  } catch {
    // fetch 실패해도 계속 진행
  }

  const accountBtn = new ButtonBuilder()
    .setCustomId('ticket_account_select')
    .setLabel('💳 계좌 확인')
    .setStyle(ButtonStyle.Primary);

  const priceBtn = new ButtonBuilder()
    .setCustomId(`ticket_price_${robux}`)
    .setLabel('💰 가격 확인')
    .setStyle(ButtonStyle.Success);

  await message.channel.send({
    components: [new ActionRowBuilder().addComponents(accountBtn, priceBtn)],
  });
}

// ─────────────────────────────────────────
// 버튼/선택메뉴 상호작용 처리
// ─────────────────────────────────────────
async function handleInfoComponent(interaction) {
  // 1) 계좌 확인 버튼 → 사람 선택 메뉴 표시
  if (interaction.isButton() && interaction.customId === 'ticket_account_select') {
    const select = new StringSelectMenuBuilder()
      .setCustomId('ticket_account_show')
      .setPlaceholder('계좌를 확인할 사람을 선택하세요')
      .addOptions(
        ACCOUNTS.map((acc, i) => ({
          label: acc.name,
          value: String(i),
        }))
      );

    return interaction.reply({
      content: '계좌를 확인할 사람을 선택해주세요.',
      components: [new ActionRowBuilder().addComponents(select)],
      ephemeral: false,
    });
  }

  // 2) 사람 선택 완료 → 계좌 임베드 출력
  if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_account_show') {
    const idx = Number(interaction.values[0]);
    const acc = ACCOUNTS[idx];
    if (!acc) return interaction.reply({ content: '⚠️ 잘못된 선택이에요.', ephemeral: true });

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(`💳 ${acc.name} 계좌 정보`)
      .addFields(
        { name: '은행', value: acc.bank, inline: true },
        { name: '계좌번호', value: acc.number, inline: true },
        { name: '예금주', value: acc.holder, inline: true },
      )
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }

  // 3) 가격 확인 버튼 → 가격 계산 후 임베드 출력
  if (interaction.isButton() && interaction.customId.startsWith('ticket_price_')) {
    const robux = Number(interaction.customId.replace('ticket_price_', ''));
    if (!robux || Number.isNaN(robux)) {
      return interaction.reply({ content: '⚠️ 로벅스 수량을 읽지 못했어요.', ephemeral: true });
    }

    const price = calculatePrice(robux);

    const embed = new EmbedBuilder()
      .setColor(0x2ECC71)
      .setTitle('💰 가격 안내')
      .addFields(
        { name: '로벅스 수량', value: `${robux.toLocaleString('ko-KR')} R$`, inline: true },
        { name: '가격', value: price, inline: true },
        { name: '기준', value: '1만원 = 1,400 로벅스', inline: false },
      )
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }
}

module.exports = { handleTicketInfoButtons, handleInfoComponent };
