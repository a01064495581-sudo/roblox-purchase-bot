const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelType,
  StringSelectMenuBuilder,
  AttachmentBuilder,
} = require('discord.js');

// 영수증 카드 이미지 렌더링 모듈은 안전하게(지연) 로드합니다.
// @napi-rs/canvas가 어떤 이유로든 설치/로드되지 않더라도(예: 배포 환경 문제),
// 이 require가 구매로그.js 전체를 깨뜨리면 안 되므로 try/catch로 감쌉니다.
// 로드에 실패하면 renderPurchaseCard는 null이 되고, buildPurchaseResult가
// 자동으로 텍스트 임베드(fallback)로 전환합니다.
let renderPurchaseCard = null;
try {
  renderPurchaseCard = require('../lib/purchase-card.js').renderPurchaseCard;
} catch (err) {
  console.error('⚠️ [구매로그] purchase-card.js 로드 실패 (영수증 카드 이미지 기능 비활성화, 텍스트 임베드로 계속 동작):', err.message);
}

// 닉네임으로 정확히 일치하는 로블록스 유저 정보(ID) 조회
async function getRobloxUser(username) {
  try {
    const res = await fetch('https://users.roblox.com/v1/usernames/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        usernames: [username],
        excludeBannedUsers: false,
      }),
    });
    const data = await res.json();
    if (!data.data || data.data.length === 0) return null;
    return data.data[0]; // { id, name, displayName, ... }
  } catch (err) {
    console.error('로블록스 유저 조회 실패:', err);
    return null;
  }
}

// 유저ID로 프로필(헤드샷) 이미지 URL 조회
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

// 자동 버튼으로 구매로그 작성 시 사용할 고정 로그 채널 ID
const FIXED_LOG_CHANNEL_ID = '1517798871781085264';

function generatePurchaseId() {
  // 이미지 예시(1413037862911344640)처럼 19자리 숫자 생성
  let id = String(Math.floor(Math.random() * 9) + 1); // 첫자리는 0 아님
  for (let i = 0; i < 18; i++) {
    id += Math.floor(Math.random() * 10);
  }
  return id;
}

// 1만원당 1400로벅스 기준 가격 자동 계산
function calculatePrice(robux) {
  const won = Math.round(robux * (10000 / 1400));
  return `${won.toLocaleString()}원`;
}

// ---------------------------------------------------------------------------
// Ticket Tool 양식 파싱
//
// Ticket Tool은 fields를 쓰지 않고, 실제로는 아래와 같은 정확한 마크다운 형태로
// embed.description에 질문/답변을 통째로 넣습니다 (실제 로그로 확인된 형태):
//
//   **로벅스 구매 수량** ```
//   1828```
//   **로블록스 닉네임** ```
//   snsndn```
//   **구매하실 게임** ```
//   누눙```
//   **구매하실 게임패스** ```
//   누융```
//
// 즉 "**라벨**" 다음에 코드블록(```)이 오고, 그 안에 값이 들어있는 구조입니다.
// 줄바꿈 위치가 라벨/코드블록 경계와 항상 일치하지 않을 수 있어서
// 줄 단위 파싱 대신 정규식으로 "**라벨** ```...```" 패턴을 직접 매칭합니다.
// ---------------------------------------------------------------------------

const LABELS = {
  robux: ['로벅스 구매 수량', '구매 수량', '로벅스 수량'],
  nickname: ['로블록스 닉네임', '닉네임'],
  // "구매하실 게임"과 "구매하실 게임패스"를 구분해야 하므로
  // game은 "게임패스"가 붙은 라벨보다 먼저 매칭되지 않도록 순서/검증에 주의
  game: ['구매하실 게임', '게임 이름', '게임'],
};

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 전체 텍스트(여러 임베드의 description을 합친 것)에서
// "**라벨** ```값```" 패턴을 찾아 값만 추출
// negativeLookaheadAfter: 라벨 뒤에 이 문자열이 곧바로 이어지면 매칭하지 않음
// (예: "구매하실 게임" 라벨이 "구매하실 게임패스"의 일부로 잘못 매칭되는 것을 방지)
function extractValue(fullText, labelCandidates, negativeLookaheadAfter = []) {
  for (const label of labelCandidates) {
    const negativeLookahead = negativeLookaheadAfter
      .map(s => `(?!${escapeRegex(s)})`)
      .join('');

    // **라벨[lookahead]** 다음에 (공백/줄바꿈 후) ```로 시작하는 코드블록, 그 안의 내용을 캡처
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

// Ticket Tool 양식 메시지(임베드)에서 닉네임/게임/로벅스 수량을 추출
// description 텍스트 기반 파싱 (fields는 비어있는 경우가 대부분이라 사용하지 않음)
function parseTicketForm(message) {
  if (message.embeds.length === 0) return null;

  // 모든 임베드의 description을 하나로 합쳐서 검색 (안내 임베드 + 양식 임베드가 분리되어 있을 수 있음)
  const fullText = message.embeds
    .map(embed => embed.description || '')
    .join('\n');

  if (!fullText.trim()) return null;

  const robuxText = extractValue(fullText, LABELS.robux);
  const nickname = extractValue(fullText, LABELS.nickname);
  // "구매하실 게임" 라벨이 "구매하실 게임패스"의 일부로 잘못 매칭되지 않도록
  // "게임" 뒤에 곧바로 "패스"가 오지 않는 경우만 매칭
  const game = extractValue(fullText, LABELS.game, ['패스']);

  if (!robuxText || !nickname || !game) return null;

  // "1828" 같은 숫자 텍스트만 추출 (쉼표 포함 가능)
  const robuxMatch = robuxText.match(/[\d,]+/);
  if (!robuxMatch) return null;
  const robux = Number(robuxMatch[0].replace(/,/g, ''));

  if (!robux || Number.isNaN(robux)) return null;

  return { nickname, game, robux };
}

// 닉네임을 제외한 나머지 정보로 구매 임베드 + 영수증 카드 이미지를 만드는 공용 함수
// (최초 실행 / 버튼 재입력 후 모두 재사용)
async function buildPurchaseResult({ buyer, nickname, passType, game, robux, price }) {
  const purchaseId = generatePurchaseId();
  const robloxUser = await getRobloxUser(nickname);

  let robloxProfileUrl;
  let avatarUrl = null;
  let notFound = false;

  if (robloxUser) {
    robloxProfileUrl = `https://www.roblox.com/users/${robloxUser.id}/profile`;
    avatarUrl = await getRobloxAvatar(robloxUser.id);
  } else {
    notFound = true;
    robloxProfileUrl = `https://www.roblox.com/search/users?keyword=${encodeURIComponent(nickname)}`;
  }

  const dateText = new Date().toLocaleString('ko-KR');

  // 구매 정보를 영수증 카드 이미지(PNG)로 렌더링 시도
  // 카드 디자인은 항상 동일한 틀(레이아웃/색상)이고, 텍스트 정보만 매번 채워집니다.
  // 렌더링이 실패해도(예: 폰트/캔버스 문제) 구매로그 자체는 계속 작동해야 하므로 안전하게 처리하고,
  // 실패 시에는 기존처럼 텍스트 임베드로 모든 정보를 보여줍니다 (fallback).
  let cardAttachment = null;
  try {
    if (!renderPurchaseCard) throw new Error('renderPurchaseCard 모듈이 로드되지 않음');
    const buffer = await renderPurchaseCard({
      buyerTag: `${buyer.username}`,
      nickname,
      avatarUrl,
      notFound,
      passType,
      game,
      robux,
      price,
      purchaseId,
      dateText,
    });
    cardAttachment = new AttachmentBuilder(buffer, { name: 'purchase-card.png' });
  } catch (err) {
    console.error('❌ [구매로그] 영수증 카드 이미지 렌더링 실패, 텍스트 임베드로 대체합니다:', err);
  }

  const embed = new EmbedBuilder().setColor(notFound ? 0xE67E22 : 0xF1C40F);

  if (cardAttachment) {
    // 카드 렌더링 성공: 이미지가 정보를 전부 보여주므로 임베드는 이미지 틀 역할만 함
    embed.setImage('attachment://purchase-card.png');
  } else {
    // 카드 렌더링 실패: 기존 텍스트 레이아웃으로 모든 정보를 표시 (정보 누락 없음)
    embed
      .setAuthor({ name: '✅ 구매 완료' })
      .setDescription(
        `${buyer} (${buyer.username})\n` +
        (notFound
          ? `[${nickname}](${robloxProfileUrl}) ⚠️ 일치하는 유저를 찾지 못했어요`
          : `[${nickname}](${robloxProfileUrl})`)
      )
      .addFields(
        { name: '패스 타입', value: passType, inline: true },
        { name: '게임', value: game, inline: true },
        { name: '로벅스 · 가격', value: `${robux.toLocaleString()} R$ · ${price}`, inline: true },
      )
      .setFooter({ text: `구매 ID ${purchaseId} · ${dateText}` });
    if (avatarUrl) embed.setThumbnail(avatarUrl);
  }

  embed.setTimestamp();

  return { embed, notFound, cardAttachment };
}

// 재입력 버튼에 현재 정보를 실어 보내기 위한 직렬화/역직렬화
// customId 길이 제한(100자) 때문에 닉네임을 뺀 나머지만 압축해서 담음
// game 이름에 구분자(::)가 포함될 가능성은 낮지만 안전하게 escape 처리
const SEP = '::';
const CUSTOM_ID_LIMIT = 100;

function encodeState({ buyerId, passType, game, robux, price }) {
  const safeGame = game.replaceAll(SEP, '/');
  const safePrice = price.replaceAll(SEP, '/');
  let encoded = `retry_nick${SEP}${buyerId}${SEP}${passType}${SEP}${safeGame}${SEP}${robux}${SEP}${safePrice}`;

  // 100자를 넘으면 게임/가격 텍스트를 줄여서 절대 길이 제한을 넘지 않도록 함
  if (encoded.length > CUSTOM_ID_LIMIT) {
    const overflow = encoded.length - CUSTOM_ID_LIMIT;
    const trimmedGame = safeGame.slice(0, Math.max(1, safeGame.length - overflow - 3)) + '...';
    encoded = `retry_nick${SEP}${buyerId}${SEP}${passType}${SEP}${trimmedGame}${SEP}${robux}${SEP}${safePrice}`;
  }

  return encoded;
}

function decodeState(customId) {
  const [, buyerId, passType, game, robux, price] = customId.split(SEP);
  return { buyerId, passType, game, robux: Number(robux), price };
}

// 티켓 양식 자동 인식 버튼/선택메뉴용 상태 인코딩
// "autoform" 접두사로 위 retry_nick 계열과 구분
const AUTOFORM_SEP = '||';
function encodeFormState({ messageId, buyerId, nickname, game, robux }) {
  const safeGame = game.replaceAll(AUTOFORM_SEP, '/');
  const safeNickname = nickname.replaceAll(AUTOFORM_SEP, '');
  let encoded = `autoform${AUTOFORM_SEP}${messageId}${AUTOFORM_SEP}${buyerId}${AUTOFORM_SEP}${safeNickname}${AUTOFORM_SEP}${safeGame}${AUTOFORM_SEP}${robux}`;

  // customId 100자 제한 보호
  if (encoded.length > CUSTOM_ID_LIMIT) {
    const overflow = encoded.length - CUSTOM_ID_LIMIT;
    const trimmedGame = safeGame.slice(0, Math.max(1, safeGame.length - overflow - 3)) + '...';
    encoded = `autoform${AUTOFORM_SEP}${messageId}${AUTOFORM_SEP}${buyerId}${AUTOFORM_SEP}${safeNickname}${AUTOFORM_SEP}${trimmedGame}${AUTOFORM_SEP}${robux}`;
  }
  return encoded;
}

function decodeFormState(customId) {
  const [, messageId, buyerId, nickname, game, robux] = customId.split(AUTOFORM_SEP);
  return { messageId, buyerId, nickname, game, robux: Number(robux) };
}

// ---------------------------------------------------------------------------
// 티켓 양식 자동 인식 정보 저장소
//
// 예전에는 양식이 인식되면 즉시 "구매로그 작성" 버튼을 보냈지만,
// 이제는 /감사 명령어를 실행하는 시점에 버튼을 보내도록 바뀌어서,
// 양식 정보를 채널ID 기준으로 메모리에 저장해뒀다가 나중에 꺼내 씁니다.
// (서버 재시작 시 초기화되지만, 같은 배포 주기 안에서는 충분합니다.)
// ---------------------------------------------------------------------------
const ticketFormStore = new Map(); // channelId -> { messageId, buyerId, nickname, game, robux }

function storeTicketFormData(channelId, data) {
  ticketFormStore.set(channelId, data);
}

function getTicketFormData(channelId) {
  return ticketFormStore.get(channelId) || null;
}

module.exports = {
  // index.js의 messageCreate 이벤트에서 호출 - Ticket Tool 양식 메시지를 감지해서
  // 정보를 저장해둡니다. (버튼은 더 이상 여기서 즉시 보내지 않고, /감사 명령어 실행 시 보냅니다.)
  async handleTicketFormMessage(message) {
    // 봇이 보낸 메시지만 확인 (Ticket Tool도 봇이라 isBot이 true)
    if (!message.author.bot) return;
    if (message.embeds.length === 0) return;

    // 디버그: 임베드 구조를 그대로 콘솔에 출력해서 실제 필드명/형태를 확인
    console.log('🔍 [디버그] 봇 메시지 감지:', message.author.tag);
    console.log('🔍 [디버그] 임베드 개수:', message.embeds.length);
    message.embeds.forEach((embed, i) => {
      console.log(`🔍 [디버그] 임베드 ${i} - title:`, embed.title);
      console.log(`🔍 [디버그] 임베드 ${i} - description:`, embed.description);
      console.log(`🔍 [디버그] 임베드 ${i} - fields:`, JSON.stringify(embed.fields, null, 2));
    });

    const parsed = parseTicketForm(message);
    console.log('🔍 [디버그] 파싱 결과:', parsed);
    if (!parsed) {
      console.log('🔍 [디버그] 파싱 실패로 정보를 저장하지 않고 종료합니다.');
      return; // 우리가 아는 양식이 아니면 무시
    }

    // 티켓을 연 사람(구매자) 찾기: 안내 임베드 본문에 멘션된 첫 유저로 추정
    // 멘션이 안 잡히면 버튼 누른 관리자가 직접 고르게 함 (/감사 버튼 처리 시점에)
    const mentionedUser = message.mentions.users.first() || null;

    // 버튼을 즉시 보내지 않고, 정보만 채널 기준으로 저장해둠
    // -> /감사 명령어 실행 시 thanks.js가 이 정보를 꺼내서 버튼을 만듦
    storeTicketFormData(message.channel.id, {
      messageId: message.id,
      buyerId: mentionedUser?.id || '',
      nickname: parsed.nickname,
      game: parsed.game,
      robux: parsed.robux,
    });
    console.log(`🔍 [디버그] 채널 ${message.channel.id}에 양식 정보 저장 완료. (/감사 실행 시 버튼 전송)`);
  },

  // thanks.js 등 다른 파일에서 저장된 양식 정보를 꺼내 쓸 때 사용
  getTicketFormData,

  // autoform customId를 만들 때 사용 (thanks.js에서도 동일한 형식으로 버튼을 만들기 위해 노출)
  encodeFormState,

  data: new SlashCommandBuilder()
    .setName('구매로그')
    .setDescription('로벅스 구매 로그를 티켓에 기록합니다')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) // 관리자만 사용 가능
    .addUserOption(option =>
      option.setName('구매자')
        .setDescription('구매한 사람을 멘션하세요')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('닉네임')
        .setDescription('로블록스 닉네임')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('패스타입')
        .setDescription('구매 타입을 선택하세요')
        .setRequired(true)
        .addChoices(
          { name: '인게임 선물', value: '인게임 선물' },
          { name: '로벅스 송금', value: '로벅스 송금' },
          { name: '게임패스 구매', value: '게임패스 구매' },
        ))
    .addStringOption(option =>
      option.setName('게임')
        .setDescription('구매한 게임 이름 (로벅스 송금인 경우 "해당없음" 등으로 입력)')
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('로벅스')
        .setDescription('구매한 로벅스 수량')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('가격')
        .setDescription('가격 (예: 700원)')
        .setRequired(true))
    .addChannelOption(option =>
      option.setName('로그채널')
        .setDescription('구매로그 임베드를 올릴 채널을 선택하세요')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)),

  async execute(interaction) {
    // 이중 안전장치: setDefaultMemberPermissions는 서버 관리자가 바꿀 수 있는 "기본값"일 뿐이라
    // 실행 시점에도 관리자 권한을 한 번 더 확인합니다.
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({
        content: '🚫 이 명령어는 관리자 권한을 가진 멤버만 사용할 수 있어요.',
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true }); // 티켓 채널에는 본인에게만 보이는 처리중 표시

    const buyer = interaction.options.getUser('구매자');
    const nickname = interaction.options.getString('닉네임');
    const passType = interaction.options.getString('패스타입');
    const game = interaction.options.getString('게임');
    const robux = interaction.options.getInteger('로벅스');
    const price = interaction.options.getString('가격');
    const logChannel = interaction.options.getChannel('로그채널');

    // 로그 채널에 봇이 메시지를 보낼 권한이 있는지 미리 확인
    const botMember = interaction.guild.members.me;
    const channelPerms = logChannel.permissionsFor(botMember);
    if (!channelPerms?.has(PermissionFlagsBits.ViewChannel) || !channelPerms?.has(PermissionFlagsBits.SendMessages)) {
      return interaction.editReply({
        content: `🚫 ${logChannel}에 메시지를 보낼 권한이 없어요. 채널 권한을 확인해주세요.`,
      });
    }

    const { embed, notFound, cardAttachment } = await buildPurchaseResult({ buyer, nickname, passType, game, robux, price });

    const payload = { embeds: [embed] };
    if (cardAttachment) payload.files = [cardAttachment];

    if (notFound) {
      const retryButton = new ButtonBuilder()
        .setCustomId(encodeState({ buyerId: buyer.id, passType, game, robux, price }))
        .setLabel('닉네임 다시 입력')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🔁');

      payload.components = [new ActionRowBuilder().addComponents(retryButton)];
    }

    // 실제 구매로그 임베드는 선택한 로그 채널에 전송 (모두에게 보임)
    await logChannel.send(payload);

    // 티켓 채널(명령어 실행 위치)에는 본인에게만 보이는 간단한 확인 메시지만 표시
    await interaction.editReply({
      content: `✅ 로그 등록됨 → ${logChannel}`,
    });
  },

  // 버튼/모달 상호작용 처리 (index.js의 interactionCreate 핸들러에서 호출해주세요)
  async handleComponent(interaction) {
    // 1) "닉네임 다시 입력" 버튼 클릭 -> 모달 띄우기
    if (interaction.isButton() && interaction.customId.startsWith('retry_nick')) {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({
          content: '🚫 이 작업은 관리자 권한을 가진 멤버만 할 수 있어요.',
          ephemeral: true,
        });
      }

      const modal = new ModalBuilder()
        .setCustomId(interaction.customId.replace('retry_nick', 'submit_nick'))
        .setTitle('로블록스 닉네임 다시 입력');

      const nicknameInput = new TextInputBuilder()
        .setCustomId('nickname_input')
        .setLabel('정확한 로블록스 닉네임을 입력하세요')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(nicknameInput));
      return interaction.showModal(modal);
    }

    // 2) 모달 제출 -> 닉네임으로 다시 조회해서 임베드 갱신
    if (interaction.isModalSubmit() && interaction.customId.startsWith('submit_nick')) {
      await interaction.deferUpdate();

      const state = decodeState(interaction.customId.replace('submit_nick', 'retry_nick'));
      const newNickname = interaction.fields.getTextInputValue('nickname_input');
      const buyer = await interaction.client.users.fetch(state.buyerId);

      const { embed, notFound, cardAttachment } = await buildPurchaseResult({
        buyer,
        nickname: newNickname,
        passType: state.passType,
        game: state.game,
        robux: state.robux,
        price: state.price,
      });

      const payload = { embeds: [embed] };
      if (cardAttachment) payload.files = [cardAttachment];

      if (notFound) {
        const retryButton = new ButtonBuilder()
          .setCustomId(encodeState({ buyerId: state.buyerId, passType: state.passType, game: state.game, robux: state.robux, price: state.price }))
          .setLabel('닉네임 다시 입력')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🔁');
        payload.components = [new ActionRowBuilder().addComponents(retryButton)];
      } else {
        payload.components = []; // 찾았으면 버튼 제거
      }

      await interaction.editReply(payload);
    }

    // 3) "📋 구매로그 작성" 버튼 클릭 -> 구매자가 자동으로 잡혔으면 패스 타입 선택 메뉴,
    //    못 잡았으면 먼저 구매자를 입력받는 모달
    if (interaction.isButton() && interaction.customId.startsWith('autoform')) {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({
          content: '🚫 이 작업은 관리자 권한을 가진 멤버만 할 수 있어요.',
          ephemeral: true,
        });
      }

      const state = decodeFormState(interaction.customId);

      if (!state.buyerId) {
        // 구매자를 자동으로 못 찾은 경우: 멘션을 텍스트로 입력받는 모달
        const modal = new ModalBuilder()
          .setCustomId(interaction.customId.replace('autoform', 'autoform_buyer'))
          .setTitle('구매자 지정');

        const buyerInput = new TextInputBuilder()
          .setCustomId('buyer_id_input')
          .setLabel('구매자의 디스코드 ID를 입력하세요')
          .setPlaceholder('유저 우클릭 > ID 복사')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(buyerInput));
        return interaction.showModal(modal);
      }

      // 구매자가 이미 있으면 바로 패스 타입 선택 메뉴 표시
      const select = new StringSelectMenuBuilder()
        .setCustomId(interaction.customId.replace('autoform', 'autoform_pass'))
        .setPlaceholder('패스 타입을 선택하세요')
        .addOptions(
          { label: '인게임 선물', value: '인게임 선물' },
          { label: '로벅스 송금', value: '로벅스 송금' },
          { label: '게임패스 구매', value: '게임패스 구매' },
        );

      return interaction.reply({
        content: '패스 타입을 선택해주세요.',
        components: [new ActionRowBuilder().addComponents(select)],
        ephemeral: true,
      });
    }

    // 4) 구매자 ID 모달 제출 -> 패스 타입 선택 메뉴로 이어감
    if (interaction.isModalSubmit() && interaction.customId.startsWith('autoform_buyer')) {
      const state = decodeFormState(interaction.customId.replace('autoform_buyer', 'autoform'));
      const buyerIdRaw = interaction.fields.getTextInputValue('buyer_id_input').replace(/[<@!>]/g, '').trim();

      let buyer;
      try {
        buyer = await interaction.client.users.fetch(buyerIdRaw);
      } catch {
        return interaction.reply({
          content: '🚫 입력한 ID로 유저를 찾지 못했어요. 디스코드 ID가 맞는지 확인해주세요.',
          ephemeral: true,
        });
      }

      const newCustomId = encodeFormState({
        messageId: state.messageId,
        buyerId: buyer.id,
        nickname: state.nickname,
        game: state.game,
        robux: state.robux,
      });

      const select = new StringSelectMenuBuilder()
        .setCustomId(newCustomId.replace('autoform', 'autoform_pass'))
        .setPlaceholder('패스 타입을 선택하세요')
        .addOptions(
          { label: '인게임 선물', value: '인게임 선물' },
          { label: '로벅스 송금', value: '로벅스 송금' },
          { label: '게임패스 구매', value: '게임패스 구매' },
        );

      return interaction.reply({
        content: `구매자: ${buyer} — 패스 타입을 선택해주세요.`,
        components: [new ActionRowBuilder().addComponents(select)],
        ephemeral: true,
      });
    }

    // 5) 패스 타입 선택 완료 -> 가격 자동 계산 후 고정 로그 채널에 최종 임베드 전송
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('autoform_pass')) {
      await interaction.deferUpdate();

      const state = decodeFormState(interaction.customId.replace('autoform_pass', 'autoform'));
      const passType = interaction.values[0];
      const buyer = await interaction.client.users.fetch(state.buyerId);
      const price = calculatePrice(state.robux);

      const logChannel = await interaction.client.channels.fetch(FIXED_LOG_CHANNEL_ID).catch(() => null);
      if (!logChannel) {
        return interaction.editReply({
          content: '🚫 고정 로그 채널을 찾지 못했어요. 코드에 설정된 채널 ID를 확인해주세요.',
          components: [],
        });
      }

      const botMember = interaction.guild.members.me;
      const channelPerms = logChannel.permissionsFor(botMember);
      if (!channelPerms?.has(PermissionFlagsBits.ViewChannel) || !channelPerms?.has(PermissionFlagsBits.SendMessages)) {
        return interaction.editReply({
          content: `🚫 ${logChannel}에 메시지를 보낼 권한이 없어요.`,
          components: [],
        });
      }

      const { embed, notFound, cardAttachment } = await buildPurchaseResult({
        buyer,
        nickname: state.nickname,
        passType,
        game: state.game,
        robux: state.robux,
        price,
      });

      const payload = { embeds: [embed] };
      if (cardAttachment) payload.files = [cardAttachment];

      if (notFound) {
        const retryButton = new ButtonBuilder()
          .setCustomId(encodeState({ buyerId: buyer.id, passType, game: state.game, robux: state.robux, price }))
          .setLabel('닉네임 다시 입력')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🔁');
        payload.components = [new ActionRowBuilder().addComponents(retryButton)];
      }

      await logChannel.send(payload);

      await interaction.editReply({
        content: `✅ 로그 등록됨 → ${logChannel} (가격 자동계산: ${price})`,
        components: [],
      });
    }
  },
};
