// commands/실시간재고.js
// 관리자가 /실시간재고 명령어로 로벅스 재고 현황을 예쁜 임베드로 채널에 올리는 기능
// - 첫 전송 시: 새 메시지 생성 후 메시지 ID를 채널 topic에 저장
// - 이후 새로고침 시: 기존 메시지를 수정 (새 메시지 생성 X)
// - 마지막 수정 시각을 임베드에 표시

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
const STOCK_CHANNEL_ID    = '1508377939572559932';
const HOW_TO_USE_CHANNEL_ID = '1508377251270496326';
const BANNER_IMAGE_URL    = 'https://cdn.discordapp.com/attachments/1388285653640282246/1519064788020236369/32342.gif';

// ─────────────────────────────────────────
// 지급 방식 선택지
// ─────────────────────────────────────────
const PAYMENT_METHODS = [
  { label: '인게임 게임패스 선물하기', value: 'gift_gamepass', emoji: '🎁' },
  { label: '게임패스 구매하기',        value: 'buy_gamepass',  emoji: '🛒' },
  { label: '로벅스 송금하기',          value: 'transfer_robux', emoji: '💸' },
];

const SEP = '::';

function encodeState({ robux, available }) {
  return `stock_pay${SEP}${robux}${SEP}${available}`;
}
function decodeState(customId) {
  const [, robux, available] = customId.split(SEP);
  return { robux: Number(robux), available };
}
function buildPaymentMethodsText(selectedValues) {
  return PAYMENT_METHODS.map(m => {
    const checked = selectedValues.includes(m.value);
    return `${m.emoji} ${m.label} ${checked ? '✅' : '❌'}`;
  }).join('\n');
}

// ─────────────────────────────────────────
// 재고 임베드 빌드
// ─────────────────────────────────────────
function buildStockEmbed({ robux, available, selectedValues }) {
  const isAvailable = available === '가능';
  const now = new Date().toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });

  return new EmbedBuilder()
    .setColor(isAvailable ? 0xF1C40F : 0x95A5A6)
    .setImage(BANNER_IMAGE_URL)
    .setTitle('🌀 실시간 로벅스 재고 🌀')
    .setDescription(
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
    .setFooter({ text: `🐝 꿀벌 로벅스샵 · 마지막 업데이트: ${now}` })
    .setTimestamp();
}

// ─────────────────────────────────────────
// 기존 메시지 수정 or 새 메시지 전송
// 채널 topic에 메시지 ID를 "stock_msg_id:<id>" 형태로 저장해서 추적
// ─────────────────────────────────────────
async function sendOrEditStockEmbed(client, { robux, available, selectedValues }) {
  const channel = await client.channels.fetch(STOCK_CHANNEL_ID).catch(() => null);
  if (!channel) throw new Error('재고 채널을 찾을 수 없어요. STOCK_CHANNEL_ID를 확인해주세요.');

  const embed = buildStockEmbed({ robux, available, selectedValues });

  // 채널 topic에서 기존 메시지 ID 추출
  const topic = channel.topic || '';
  const match = topic.match(/stock_msg_id:(\d+)/);
  const existingMsgId = match ? match[1] : null;

  if (existingMsgId) {
    // 기존 메시지 수정 시도
    try {
      const existingMsg = await channel.messages.fetch(existingMsgId);
      await existingMsg.edit({ embeds: [embed] });
      return channel;
    } catch (err) {
      // 메시지가 삭제됐거나 찾을 수 없으면 새로 전송
      console.warn('⚠️ [실시간재고] 기존 메시지 수정 실패, 새로 전송합니다:', err.message);
    }
  }

  // 새 메시지 전송 후 메시지 ID를 topic에 저장
  const newMsg = await channel.send({ embeds: [embed] });

  // topic 업데이트 (기존 topic 유지하면서 stock_msg_id만 교체)
  const newTopic = topic.replace(/stock_msg_id:\d+/, '').trim() + ` stock_msg_id:${newMsg.id}`;
  await channel.setTopic(newTopic.trim()).catch(e => {
    console.warn('⚠️ [실시간재고] 채널 topic 저장 실패 (채널 관리 권한 필요):', e.message);
  });

  return channel;
}

// ─────────────────────────────────────────
// 슬래시 명령어
// ─────────────────────────────────────────
module.exports = {
  data: new SlashCommandBuilder()
    .setName('실시간재고')
    .setDescription('실시간 로벅스 재고 임베드를 등록/업데이트합니다')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
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
          { name: '가능',   value: '가능'   },
          { name: '불가능', value: '불가능' },
        )),

  async execute(interaction) {
    if (!isAllowed(interaction)) return replyNoPermission(interaction);

    const robux     = interaction.options.getInteger('로벅스');
    const available = interaction.options.getString('처리가능여부');

    const select = new StringSelectMenuBuilder()
      .setCustomId(encodeState({ robux, available }))
      .setPlaceholder('가능한 지급 방식을 모두 선택하세요 (여러 개 선택 가능)')
      .setMinValues(1)
      .setMaxValues(PAYMENT_METHODS.length)
      .addOptions(PAYMENT_METHODS.map(m => ({
        label: m.label, value: m.value, emoji: m.emoji,
      })));

    return interaction.reply({
      content: `🐝 로벅스 \`${robux.toLocaleString('ko-KR')} R$\` · 처리가능여부 \`${available}\`\n가능한 지급 방식을 아래에서 선택해주세요.`,
      components: [new ActionRowBuilder().addComponents(select)],
      ephemeral: true,
    });
  },

  async handleComponent(interaction) {
    if (!interaction.isStringSelectMenu() || !interaction.customId.startsWith('stock_pay')) return;
    if (!isAllowed(interaction)) return replyNoPermission(interaction);

    await interaction.deferUpdate();

    const { robux, available } = decodeState(interaction.customId);
    const selectedValues = interaction.values;

    try {
      const channel = await sendOrEditStockEmbed(interaction.client, { robux, available, selectedValues });
      await interaction.editReply({
        content: `✅ 실시간 재고가 업데이트됐어요 → ${channel}`,
        components: [],
      });
    } catch (err) {
      console.error('❌ [실시간재고] 임베드 처리 실패:', err);
      await interaction.editReply({
        content: `🚫 처리에 실패했어요: ${err.message}`,
        components: [],
      });
    }
  },
};
