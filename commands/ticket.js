// commands/ticket.js
// 🎫 꿀벌로벅스 티켓 시스템
// - 로벅스 구매 문의 / 인게임 구매 문의 / 문의하기 3가지 카테고리
// - 각 카테고리별 전용 채널 카테고리에 티켓 채널 생성
// - 티켓 오픈 시 자동 멘션 + 임베드 양식 전송
// - 유저당 최대 3개 티켓 제한

require('dotenv').config();
const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelType,
  PermissionFlagsBits,
  PermissionsBitField,
} = require('discord.js');
const { isAllowed, replyNoPermission } = require('../lib/permissions.js');

// ─────────────────────────────────────────────
// 🔧 환경변수 설정 안내 (.env에 아래 값들을 추가하세요)
// TICKET_CHANNEL_ID         = 티켓 열기 임베드를 보낼 채널 ID
// TICKET_ADMIN_ROLE_ID      = 관리자 역할 ID (티켓에 자동 추가됨)
// TICKET_ROBUX_CATEGORY_ID  = 로벅스 구매 문의 카테고리 ID
// TICKET_INGAME_CATEGORY_ID = 인게임 구매 문의 카테고리 ID
// TICKET_GENERAL_CATEGORY_ID= 문의하기 카테고리 ID
// ─────────────────────────────────────────────

// 유저당 최대 오픈 티켓 수
const MAX_TICKETS_PER_USER = 3;

// 티켓 타입 상수
const TICKET_TYPE = {
  ROBUX: 'robux',
  INGAME: 'ingame',
  GENERAL: 'general',
};

// 티켓 타입별 메타 정보
const TICKET_META = {
  [TICKET_TYPE.ROBUX]: {
    label: '🛒 로벅스 구매 문의',
    emoji: '🛒',
    color: 0xf7d01e,       // 노란색 (로벅스 색감)
    categoryEnv: 'TICKET_ROBUX_CATEGORY_ID',
    channelPrefix: '로벅스구매',
  },
  [TICKET_TYPE.INGAME]: {
    label: '🎮 인게임 구매 문의',
    emoji: '🎮',
    color: 0x57c87e,       // 초록색
    categoryEnv: 'TICKET_INGAME_CATEGORY_ID',
    channelPrefix: '인게임구매',
  },
  [TICKET_TYPE.GENERAL]: {
    label: '💬 문의하기',
    emoji: '💬',
    color: 0x5865f2,       // 디스코드 블루
    categoryEnv: 'TICKET_GENERAL_CATEGORY_ID',
    channelPrefix: '문의',
  },
};

// ─────────────────────────────────────────────
// 🔢 유저의 현재 열린 티켓 수 계산
// 채널 topic에 유저 ID를 기록해두고 카운팅
// ─────────────────────────────────────────────
function countUserTickets(guild, userId) {
  // 3개 티켓 카테고리 ID 목록
  const categoryIds = [
    process.env.TICKET_ROBUX_CATEGORY_ID,
    process.env.TICKET_INGAME_CATEGORY_ID,
    process.env.TICKET_GENERAL_CATEGORY_ID,
  ].filter(Boolean);

  let count = 0;

  for (const channel of guild.channels.cache.values()) {
    // 텍스트 채널이고 topic에 해당 유저 ID가 포함된 경우 카운트
    if (
      channel.type === ChannelType.GuildText &&
      channel.topic?.includes(userId) &&
      (categoryIds.length === 0 || categoryIds.includes(channel.parentId))
    ) {
      count++;
    }
  }

  return count;
}

// ─────────────────────────────────────────────
// 슬래시 명령어 정의
// ─────────────────────────────────────────────
const data = new SlashCommandBuilder()
  .setName('티켓패널')
  .setDescription('티켓 오픈 패널을 특정 채널에 전송합니다. (관리자 전용)')
  .addChannelOption(opt =>
    opt
      .setName('채널')
      .setDescription('패널을 보낼 채널 (미입력 시 .env의 TICKET_CHANNEL_ID 사용)')
      .setRequired(false),
  );

// ─────────────────────────────────────────────
// 슬래시 명령어 실행
// ─────────────────────────────────────────────
async function execute(interaction) {
  if (!isAllowed(interaction)) {
    return replyNoPermission(interaction);
  }

  await interaction.deferReply({ ephemeral: true });

  // 패널을 보낼 채널 결정
  const targetChannel =
    interaction.options.getChannel('채널') ||
    interaction.guild.channels.cache.get(process.env.TICKET_CHANNEL_ID);

  if (!targetChannel) {
    return interaction.editReply({
      content:
        '❌ 패널을 보낼 채널을 찾지 못했어요.\n' +
        '슬래시 명령어에서 `채널` 옵션으로 지정하거나,\n' +
        '`.env` 파일에 `TICKET_CHANNEL_ID`를 설정해주세요.',
    });
  }

  await sendTicketPanel(targetChannel);
  await interaction.editReply({
    content: `✅ <#${targetChannel.id}> 에 티켓 패널을 전송했어요!`,
  });
}

// ─────────────────────────────────────────────
// 티켓 패널 임베드 전송
// ─────────────────────────────────────────────
async function sendTicketPanel(channel) {
  const embed = new EmbedBuilder()
    .setTitle('🍯 꿀벌로벅스 구매 및 문의하기')
    .setDescription(
      '> 안녕하세요! **꿀벌로벅스** 입니다. 🐝\n' +
      '> 아래 버튼을 눌러 문의 유형에 맞는 티켓을 열어주세요.\n\n' +
      '━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
      '🛒 **로벅스 구매 문의**\n' +
      '　로벅스 구매와 관련된 문의를 합니다.\n\n' +
      '🎮 **인게임 구매 문의**\n' +
      '　인게임 아이템 구매와 관련된 문의를 합니다.\n\n' +
      '💬 **문의하기**\n' +
      '　기타 문의 사항을 남겨주세요.\n\n' +
      '━━━━━━━━━━━━━━━━━━━━━━━━\n' +
      '> ⚠️ 티켓은 문의 유형에 맞게 열어주세요.\n' +
      '> 잘못된 카테고리로 열린 티켓은 삭제될 수 있습니다.',
    )
    .setColor(0xf7d01e)
    .setThumbnail('https://i.imgur.com/8rnMkAI.png')  // 꿀벌/로벅스 이미지 (교체 가능)
    .setFooter({ text: '꿀벌로벅스 • 빠르고 싼 로벅스 서버' })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket_open_robux')
      .setLabel('로벅스 구매 문의')
      .setEmoji('🛒')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('ticket_open_ingame')
      .setLabel('인게임 구매 문의')
      .setEmoji('🎮')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('ticket_open_general')
      .setLabel('문의하기')
      .setEmoji('💬')
      .setStyle(ButtonStyle.Secondary),
  );

  await channel.send({ embeds: [embed], components: [row] });
}

// ─────────────────────────────────────────────
// 버튼 / 모달 상호작용 처리
// ─────────────────────────────────────────────
async function handleComponent(interaction) {
  const id = interaction.customId;

  // ── 티켓 열기 버튼 ──
  if (id === 'ticket_open_robux') return openTicketModal(interaction, TICKET_TYPE.ROBUX);
  if (id === 'ticket_open_ingame') return openTicketModal(interaction, TICKET_TYPE.INGAME);
  if (id === 'ticket_open_general') return openTicketModal(interaction, TICKET_TYPE.GENERAL);

  // ── 모달 제출 ──
  if (id === 'ticket_modal_robux') return createTicketChannel(interaction, TICKET_TYPE.ROBUX);
  if (id === 'ticket_modal_ingame') return createTicketChannel(interaction, TICKET_TYPE.INGAME);
  if (id === 'ticket_modal_general') return createTicketChannel(interaction, TICKET_TYPE.GENERAL);

  // ── 티켓 닫기 버튼 ──
  if (id === 'ticket_close') return closeTicket(interaction);
}

// ─────────────────────────────────────────────
// 모달 표시 (티켓 수 제한 체크 포함)
// ─────────────────────────────────────────────
async function openTicketModal(interaction, type) {
  // ── 티켓 개수 제한 체크 (모달 표시 전에 먼저 확인) ──
  const currentCount = countUserTickets(interaction.guild, interaction.user.id);
  if (currentCount >= MAX_TICKETS_PER_USER) {
    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle('⛔ 티켓 한도 초과')
          .setDescription(
            `현재 열려 있는 티켓이 **${currentCount}개** 있어요.\n` +
            `한 명당 최대 **${MAX_TICKETS_PER_USER}개**까지만 티켓을 열 수 있어요.\n\n` +
            '기존 티켓이 처리된 후에 다시 시도해주세요! 🙏',
          )
          .setColor(0xff4444)
          .setFooter({ text: '꿀벌로벅스 • 티켓 시스템' }),
      ],
      ephemeral: true,
    });
  }

  let modal;

  if (type === TICKET_TYPE.ROBUX) {
    modal = new ModalBuilder()
      .setCustomId('ticket_modal_robux')
      .setTitle('🛒 로벅스 구매 문의');

    const q1 = new TextInputBuilder()
      .setCustomId('robux_amount')
      .setLabel('1️⃣ 로벅스 구매 수량 (숫자만 입력)')
      .setPlaceholder('예: 1000')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(10);

    const q2 = new TextInputBuilder()
      .setCustomId('roblox_nickname')
      .setLabel('2️⃣ 로블록스 닉네임')
      .setPlaceholder('예: Roblox_User123')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(50);

    const q3 = new TextInputBuilder()
      .setCustomId('target_game')
      .setLabel('3️⃣ 구매하실 게임')
      .setPlaceholder('예: Blox Fruits')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(100);

    const q4 = new TextInputBuilder()
      .setCustomId('target_gamepass')
      .setLabel('4️⃣ 구매하실 게임패스')
      .setPlaceholder('예: 2x 경험치 패스')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(100);

    modal.addComponents(
      new ActionRowBuilder().addComponents(q1),
      new ActionRowBuilder().addComponents(q2),
      new ActionRowBuilder().addComponents(q3),
      new ActionRowBuilder().addComponents(q4),
    );

  } else if (type === TICKET_TYPE.INGAME) {
    modal = new ModalBuilder()
      .setCustomId('ticket_modal_ingame')
      .setTitle('🎮 인게임 구매 문의');

    const q1 = new TextInputBuilder()
      .setCustomId('item_name')
      .setLabel('1️⃣ 어떤 아이템을 구매하시나요?')
      .setPlaceholder('예: 전설 검 / 특수 스킨 등')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(200);

    const q2 = new TextInputBuilder()
      .setCustomId('roblox_nickname')
      .setLabel('2️⃣ 로블록스 닉네임을 입력해주세요')
      .setPlaceholder('예: Roblox_User123')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(50);

    const q3 = new TextInputBuilder()
      .setCustomId('extra_note')
      .setLabel('3️⃣ 기타 사항 (선택)')
      .setPlaceholder('추가로 전달하실 내용이 있으면 입력해주세요.')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false)
      .setMaxLength(500);

    modal.addComponents(
      new ActionRowBuilder().addComponents(q1),
      new ActionRowBuilder().addComponents(q2),
      new ActionRowBuilder().addComponents(q3),
    );

  } else {
    // GENERAL
    modal = new ModalBuilder()
      .setCustomId('ticket_modal_general')
      .setTitle('💬 문의하기');

    const q1 = new TextInputBuilder()
      .setCustomId('question')
      .setLabel('1️⃣ 문제사항 및 질문')
      .setPlaceholder('문의 내용을 상세히 적어주세요.')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMaxLength(1000);

    modal.addComponents(new ActionRowBuilder().addComponents(q1));
  }

  await interaction.showModal(modal);
}

// ─────────────────────────────────────────────
// 티켓 채널 생성
// ─────────────────────────────────────────────
async function createTicketChannel(interaction, type) {
  await interaction.deferReply({ ephemeral: true });

  const guild = interaction.guild;
  const user = interaction.user;
  const meta = TICKET_META[type];

  // ── 2차 안전 체크 (모달 제출 시점에 다시 확인 — 레이스 컨디션 방어) ──
  const currentCount = countUserTickets(guild, user.id);
  if (currentCount >= MAX_TICKETS_PER_USER) {
    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setTitle('⛔ 티켓 한도 초과')
          .setDescription(
            `현재 열려 있는 티켓이 **${currentCount}개** 있어요.\n` +
            `한 명당 최대 **${MAX_TICKETS_PER_USER}개**까지만 티켓을 열 수 있어요.\n\n` +
            '기존 티켓이 처리된 후에 다시 시도해주세요! 🙏',
          )
          .setColor(0xff4444)
          .setFooter({ text: '꿀벌로벅스 • 티켓 시스템' }),
      ],
    });
  }

  // 카테고리 ID 가져오기
  const categoryId = process.env[meta.categoryEnv];
  const category = categoryId ? guild.channels.cache.get(categoryId) : null;

  // 관리자 역할 ID
  const adminRoleId = process.env.TICKET_ADMIN_ROLE_ID;

  // 채널 이름 (예: 로벅스구매-username, 로벅스구매-username-2, -3 ...)
  const safeUsername = user.username.replace(/[^a-zA-Z0-9가-힣ㄱ-ㅎ]/g, '').slice(0, 20) || user.id;
  const baseChannelName = `${meta.channelPrefix}-${safeUsername}`;

  // 이미 같은 이름의 채널이 있으면 번호를 붙여서 중복 방지
  let channelName = baseChannelName;
  let suffix = 2;
  while (guild.channels.cache.find(ch => ch.name === channelName)) {
    channelName = `${baseChannelName}-${suffix}`;
    suffix++;
  }

  // ── 권한 설정 ──
  // 기본: @everyone 접근 차단
  const permissionOverwrites = [
    {
      id: guild.roles.everyone,
      deny: [PermissionFlagsBits.ViewChannel],
    },
    // 티켓 연 사람: 보기 + 메시지 보내기 + 기록 보기 + 첨부파일
    {
      id: user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
      ],
    },
  ];

  // 관리자 역할이 있으면 추가
  if (adminRoleId && guild.roles.cache.get(adminRoleId)) {
    permissionOverwrites.push({
      id: adminRoleId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.ManageMessages,
        PermissionFlagsBits.ManageChannels,
      ],
    });
  }

  // ── 채널 생성 ──
  let ticketChannel;
  try {
    ticketChannel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: category || undefined,
      permissionOverwrites,
      topic: `${meta.label} | 작성자: ${user.tag} (${user.id})`,
    });
  } catch (err) {
    console.error('티켓 채널 생성 오류:', err);
    return interaction.editReply({
      content: '❌ 티켓 채널을 생성하는 중 오류가 발생했어요. 관리자에게 문의해주세요.',
    });
  }

  // ── 모달 응답값 파싱 ──
  const fields = interaction.fields;
  let formEmbed;

  // ─────────────────────────────────────────────────────────────────
  // ⚠️  파싱 호환성 주의
  //
  // 구매로그.js의 parseTicketForm()은 embed.description에서
  //   **라벨** ```\n값\n```
  // 패턴을 정규식으로 추출합니다.
  // 아래 description 포맷은 그 패턴을 그대로 따르며,
  // 이미지(Ticket Tool 스타일)처럼 보이도록 줄바꿈·공백을 추가했습니다.
  // ─────────────────────────────────────────────────────────────────

  if (type === TICKET_TYPE.ROBUX) {
    const amount   = fields.getTextInputValue('robux_amount');
    const nickname = fields.getTextInputValue('roblox_nickname');
    const game     = fields.getTextInputValue('target_game');
    const gamepass = fields.getTextInputValue('target_gamepass');

    // 구매로그 파싱 호환 포맷 (description 기반)
    const desc =
      `**로벅스 구매 수량** \`\`\`\n${amount}\`\`\`\n` +
      `**로블록스 닉네임** \`\`\`\n${nickname}\`\`\`\n` +
      `**구매하실 게임** \`\`\`\n${game}\`\`\`\n` +
      `**구매하실 게임패스** \`\`\`\n${gamepass}\`\`\``;

    formEmbed = new EmbedBuilder()
      .setDescription(desc)
      .setColor(meta.color)
      .setFooter({ text: `티켓 작성자: ${user.tag}` })
      .setTimestamp();

  } else if (type === TICKET_TYPE.INGAME) {
    const item     = fields.getTextInputValue('item_name');
    const nickname = fields.getTextInputValue('roblox_nickname');
    const extra    = fields.getTextInputValue('extra_note') || '없음';

    const desc =
      `**어떤 아이템을 구매하시나요?** \`\`\`\n${item}\`\`\`\n` +
      `**로블록스 닉네임** \`\`\`\n${nickname}\`\`\`\n` +
      `**기타 사항** \`\`\`\n${extra}\`\`\``;

    formEmbed = new EmbedBuilder()
      .setDescription(desc)
      .setColor(meta.color)
      .setFooter({ text: `티켓 작성자: ${user.tag}` })
      .setTimestamp();

  } else {
    const question = fields.getTextInputValue('question');

    const desc =
      `**문제사항 및 질문** \`\`\`\n${question}\`\`\``;

    formEmbed = new EmbedBuilder()
      .setDescription(desc)
      .setColor(meta.color)
      .setFooter({ text: `티켓 작성자: ${user.tag}` })
      .setTimestamp();
  }

  // ── 티켓 채널에 환영 메시지 전송 ──
  const adminMention = adminRoleId ? `<@&${adminRoleId}>` : '@관리자';
  const welcomeContent =
    `• 신속하고 정확한 꿀벌로벅스 ${adminMention} <@${user.id}> •`;

  const closeRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket_close')
      .setLabel('🔒 티켓 닫기')
      .setStyle(ButtonStyle.Danger),
  );

  await ticketChannel.send({
    content: welcomeContent,
    embeds: [formEmbed],
    components: [closeRow],
  });

  // ── 사용자에게 채널 링크 안내 ──
  await interaction.editReply({
    content: `✅ 티켓이 열렸어요! → <#${ticketChannel.id}>`,
  });
}

// ─────────────────────────────────────────────
// 티켓 닫기
// ─────────────────────────────────────────────
async function closeTicket(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const channel = interaction.channel;

  // 닫기 버튼은 관리자 또는 ALLOWED_USER_IDS만 사용 가능
  if (!isAllowed(interaction)) {
    return interaction.editReply({
      content: '🚫 티켓 닫기는 관리자만 사용할 수 있어요.',
    });
  }

  await interaction.editReply({ content: '🔒 5초 후에 이 티켓 채널이 삭제됩니다...' });

  setTimeout(async () => {
    try {
      await channel.delete('티켓 닫기');
    } catch (err) {
      console.error('티켓 채널 삭제 오류:', err);
    }
  }, 5000);
}

module.exports = {
  data,
  execute,
  handleComponent,
};
