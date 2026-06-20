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
} = require('discord.js');

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

function generatePurchaseId() {
  // 이미지 예시(1413037862911344640)처럼 19자리 숫자 생성
  let id = String(Math.floor(Math.random() * 9) + 1); // 첫자리는 0 아님
  for (let i = 0; i < 18; i++) {
    id += Math.floor(Math.random() * 10);
  }
  return id;
}

// 닉네임을 제외한 나머지 정보로 구매 임베드를 만드는 공용 함수
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

  const embed = new EmbedBuilder()
    .setColor(notFound ? 0xE67E22 : 0x2ECC71)
    .setTitle('구매 완료')
    .setDescription('로벅스를 구매해주셔서 감사합니다!')
    .addFields(
      { name: '구매자', value: `${buyer}\n${buyer.username}`, inline: false },
      {
        name: '로블록스',
        value: notFound
          ? `[${nickname}](${robloxProfileUrl}) ⚠️ 정확히 일치하는 유저를 찾지 못했어요`
          : `[${nickname}](${robloxProfileUrl})`,
        inline: false,
      },
      { name: '패스 타입', value: passType, inline: false },
      { name: '게임', value: game, inline: false },
      { name: '🔶 구매 정보', value: `로벅스: ${robux.toLocaleString()} 로벅스\n가격: ${price}`, inline: false },
    )
    .setFooter({ text: `구매 ID: ${purchaseId} | ${new Date().toLocaleString('ko-KR')}` })
    .setTimestamp();

  if (avatarUrl) embed.setThumbnail(avatarUrl);

  return { embed, notFound };
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

module.exports = {
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

    const { embed, notFound } = await buildPurchaseResult({ buyer, nickname, passType, game, robux, price });

    const payload = { embeds: [embed] };

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

      const { embed, notFound } = await buildPurchaseResult({
        buyer,
        nickname: newNickname,
        passType: state.passType,
        game: state.game,
        robux: state.robux,
        price: state.price,
      });

      const payload = { embeds: [embed] };

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
  },
};
