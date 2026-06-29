// commands/실시간재고.js
// 관리자가 /실시간재고 명령어로 로벅스 재고 현황을 예쁜 임베드로 채널에 올리는 기능
// - 로벅스 수량은 직접 입력(정수)
// - 처리가능 여부는 선택(예/아니오)
// - 지급 방식은 여러 개를 동시에 체크할 수 있어야 해서, 명령어 실행 후
//   별도의 멀티 선택 메뉴(StringSelectMenu, min 1 ~ max 3)를 띄워서 받습니다.
// - 실행할 때마다 새 임베드가 고정 채널에 "누적"으로 계속 전송됩니다 (기존 메시지 수정 X).
//
// ※ 이 파일은 구매로그/계좌안내 등 다른 기능과 완전히 독립적으로 동작합니다.

const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  StringSelectMenuBuilder,
} = require('discord.js');
const { isAllowed, replyNoPermission } = require('../lib/permissions');

// ─────────────────────────────────────────
// 여기만 수정하면 됩니다
// ─────────────────────────────────────────

// 임베드를 전송할 채널 ("로벅스 입고" 채널)
const STOCK_CHANNEL_ID = '1508377939572559932';

// 임베드 안내문에서 안내할 "이용하실려면?" 링크가 가리킬 채널
const HOW_TO_USE_CHANNEL_ID = '1508377251270496326';

// 임베드 맨 위에 띄울 배너 이미지 URL
const BANNER_IMAGE_URL = 'https://cdn.discordapp.com/attachments/1388285653640282246/1519064788020236369/32342.gif';

// ─────────────────────────────────────────
// 지급 방식 선택지 (멀티 선택)
// ─────────────────────────────────────────
const PAYMENT_METHODS = [
  { label: '인게임 게임패스 선물하기', value: 'gift_gamepass', emoji: '🎁' },
  { label: '게임패스 구매하기', value: 'buy_gamepass', emoji: '🛒' },
  { label: '로벅스 송금하기', value: 'transfer_robux', emoji: '💸' },
];

// customId에 안전하게 상태를 담기 위한 구분자
const SEP = '::';

function encodeState({ robux, available }) {
  return `stock_pay${SEP}${robux}${SEP}${available}`;
}

function decodeState(customId) {
  const [, robux, available] = customId.split(SEP);
  return { robux: Number(robux), available };
}

// 선택된 지급 방식 값들을 보기 좋은 체크 리스트 텍스트로 변환
function buildPaymentMethodsText(selectedValues) {
  return PAYMENT_METHODS.map(method => {
    const checked = selectedValues.includes(method.value);
    return `${method.emoji} ${method.label} ${checked ? '✅' : '❌'}`;
  }).join('\n');
}

// 실제 재고 임베드를 만들어서 고정 채널로 전송
async function sendStockEmbed(client, { robux, available, selectedValues }) {
  const channel = await client.channels.fetch(STOCK_CHANNEL_ID).catch(() => null);
  if (!channel) {
    throw new Error('재고 채널을 찾을 수 없어요. STOCK_CHANNEL_ID를 확인해주세요.');
  }

  const isAvailable = available === '가능';

  const embed = new EmbedBuilder()
    .setColor(isAvailable ? 0xF1C40F : 0x95A5A6) // 가능: 노란색(꿀벌톤) / 불가능: 회색
    .setImage(BANNER_IMAGE_URL) // 맨 위 배너
    .setTitle('🌀 실시간 로벅스 재고 🌀')
    .setDescription(
      `*(10분마다 로벅스 재고 새로고침)*\n` +
      `\n## <:bux_gold:1516382148439965801> 로벅스 재고 : ${robux.toLocaleString('ko-KR')} <:bux_gold:1516382148439965801>\n` +
      `\`\`\`\n` +
      `🚦 처리가능 여부 :  ${isAvailable ? '가능 ✅' : '불가능 ❌'}\n` +
      `\`\`\`` +
      `\n━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🎁 **가능한 지급 방식** 🎁\n\n` +
      buildPaymentMethodsText(selectedValues) +
      `\n━━━━━━━━━━━━━━━━━━━━━━\n` +
      `\n📌 **이용하실려면?** → <#${HOW_TO_USE_CHANNEL_ID}>`
    )
    .setFooter({ text: '🐝 꿀벌 로벅스샵 · 실시간 재고 안내' })
    .setTimestamp();

  await channel.send({ embeds: [embed] });
  return channel;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('실시간재고')
    .setDescription('실시간 로벅스 재고 임베드를 등록합니다')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) // 관리자만 사용 가능
    .addIntegerOption(option =>
      option.setName('로벅스')
        .setDescription('현재 로벅스 재고 수량')
        .setRequired(true)
        .setMinValue(0))
    .addStringOption(option =>
      option.setName('처리가능여부')
        .setDescription('지금 주문 처리가 가능한가요?')
        .setRequired(true)
        .addChoices(
          { name: '가능', value: '가능' },
          { name: '불가능', value: '불가능' },
        )),

  async execute(interaction) {
    // 이중 안전장치: setDefaultMemberPermissions는 서버 관리자가 바꿀 수 있는 "기본값"일 뿐이라
    // 실행 시점에도 관리자 권한을 한 번 더 확인합니다.
    if (!isAllowed(interaction)) {
      return replyNoPermission(interaction);
    }

    const robux = interaction.options.getInteger('로벅스');
    const available = interaction.options.getString('처리가능여부');

    const select = new StringSelectMenuBuilder()
      .setCustomId(encodeState({ robux, available }))
      .setPlaceholder('가능한 지급 방식을 모두 선택하세요 (여러 개 선택 가능)')
      .setMinValues(1)
      .setMaxValues(PAYMENT_METHODS.length)
      .addOptions(
        PAYMENT_METHODS.map(method => ({
          label: method.label,
          value: method.value,
          emoji: method.emoji,
        }))
      );

    return interaction.reply({
      content: `🐝 로벅스 \`${robux.toLocaleString('ko-KR')} R$\` · 처리가능여부 \`${available}\`\n가능한 지급 방식을 아래에서 선택해주세요. (1개 이상, 여러 개 가능)`,
      components: [new ActionRowBuilder().addComponents(select)],
      ephemeral: true,
    });
  },

  // 지급 방식 선택 메뉴 처리 (index.js의 interactionCreate에서 호출)
  async handleComponent(interaction) {
    if (!interaction.isStringSelectMenu() || !interaction.customId.startsWith('stock_pay')) return;

    if (!isAllowed(interaction)) {
      return replyNoPermission(interaction);
    }

    await interaction.deferUpdate();

    const { robux, available } = decodeState(interaction.customId);
    const selectedValues = interaction.values; // 선택된 지급 방식 value 배열

    try {
      const channel = await sendStockEmbed(interaction.client, { robux, available, selectedValues });
      await interaction.editReply({
        content: `✅ 실시간 재고 임베드가 등록됐어요 → ${channel}`,
        components: [],
      });
    } catch (err) {
      console.error('❌ [실시간재고] 임베드 전송 실패:', err);
      await interaction.editReply({
        content: `🚫 임베드 전송에 실패했어요: ${err.message}`,
        components: [],
      });
    }
  },
};
