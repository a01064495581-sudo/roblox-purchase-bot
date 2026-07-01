// lib/account-select.js
// ─────────────────────────────────────────────
// 계좌 드롭다운(Select Menu) + 구매 안내 임베드 공통 모듈
//
// - guide.js(/안내 명령어, 관리자 수동 재전송용)
// - ticket.js(티켓 생성 시 자동 전송)
// 두 곳에서 공통으로 사용합니다. 계좌 정보는 이 파일 한 곳에서만 관리합니다.
// ─────────────────────────────────────────────

const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');

// GIF URL (안내 임베드 하단 이미지)
const GIF_URL = 'https://cdn.discordapp.com/attachments/1388285653640282246/1517608996230397982/1.gif?ex=6a3a32c4&is=6a38e144&hm=b199bc601081c42bbf42e04bcaec62e2b7cf64209c2b28ae5245768556716e8a&';

// ─────────────────────────────────────────
// 계좌 정보 (여기만 수정하면 전체 반영됨)
// ─────────────────────────────────────────
const ACCOUNTS = [
  { name: '박양봉', bank: '토스뱅크', number: '1001-6192-9770', holder: '박제영' },
  { name: '김양봉', bank: '토스뱅크', number: '1002-1293-2074', holder: '김부성' },
  { name: '오리',   bank: '토스뱅크', number: '1000-8188-8025', holder: '유민성' },
];

// 드롭다운/안내 임베드의 customId 접두사
// 형식: ticket_acc_select:<ticketAuthorId>
const ACCOUNT_SELECT_PREFIX = 'ticket_acc_select:';

// 1만원당 1400로벅스 기준 가격 계산
function calculatePrice(robux) {
  const won = Math.round(robux * (10000 / 1400));
  return won.toLocaleString('ko-KR') + '원';
}

// ─────────────────────────────────────────
// 로블록스 유저/아바타 조회 (guide.js와 동일한 로직)
// ─────────────────────────────────────────
async function getRobloxUser(username) {
  try {
    const res = await fetch('https://users.roblox.com/v1/usernames/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usernames: [username], excludeBannedUsers: false }),
    });
    const data = await res.json();
    if (!data?.data || data.data.length === 0) return null;
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
    if (!data?.data || data.data.length === 0) return null;
    return data.data[0].imageUrl;
  } catch (err) {
    console.error('로블록스 아바타 조회 실패:', err);
    return null;
  }
}

// 로블록스 닉네임으로 프로필 URL + 아바타 URL을 한 번에 조회 (실패해도 안전하게 null 반환)
async function fetchRobloxProfile(nickname) {
  if (!nickname) return { profileUrl: null, avatarUrl: null };
  try {
    const user = await getRobloxUser(nickname);
    if (!user) return { profileUrl: null, avatarUrl: null };
    const profileUrl = `https://www.roblox.com/users/${user.id}/profile`;
    const avatarUrl = await getRobloxAvatar(user.id);
    return { profileUrl, avatarUrl };
  } catch (err) {
    console.error('로블록스 프로필 조회 실패:', err);
    return { profileUrl: null, avatarUrl: null };
  }
}

// ─────────────────────────────────────────
// 계좌 선택 드롭다운 컴포넌트 생성
// ticketAuthorId: 이 드롭다운을 선택할 수 있는 사람(티켓 작성자) ID
// ─────────────────────────────────────────
function buildAccountSelectRow(ticketAuthorId) {
  const select = new StringSelectMenuBuilder()
    .setCustomId(`${ACCOUNT_SELECT_PREFIX}${ticketAuthorId}`)
    .setPlaceholder('입금하실 계좌를 선택해주세요')
    .addOptions(
      ACCOUNTS.map((acc, i) => ({
        label: `${acc.name} (${acc.bank})`,
        description: acc.number,
        value: String(i),
      }))
    );

  return new ActionRowBuilder().addComponents(select);
}

// ─────────────────────────────────────────
// 구매 안내 임베드 생성
// opts:
//   - robux: 로벅스 수량 (number | null) — 없으면 가격/수량 필드 생략
//   - nickname: 로블록스 닉네임 (string | null)
//   - game: 구매 게임 (string | null)
//   - gamepass: 구매 게임패스 (string | null)
//   - accountIndex: 선택된 계좌 인덱스 (number | null) — null이면 "계좌를 선택해주세요" 안내
//   - avatarUrl: 로블록스 아바타 URL (string | null)
//   - nicknameProfileUrl: 로블록스 프로필 URL (string | null)
// ─────────────────────────────────────────
function buildGuideEmbed(opts = {}) {
  const {
    robux = null,
    nickname = null,
    game = null,
    gamepass = null,
    accountIndex = null,
    avatarUrl = null,
    nicknameProfileUrl = null,
  } = opts;

  const fields = [];

  if (robux !== null && robux !== undefined && !Number.isNaN(robux)) {
    fields.push({ name: '구매 로벅스', value: `${robux.toLocaleString('ko-KR')} R$`, inline: false });
    fields.push({ name: '\u200b', value: '\u200b', inline: false });
  }

  if (nickname) {
    const nicknameValue = nicknameProfileUrl ? `[${nickname}](${nicknameProfileUrl})` : nickname;
    fields.push({ name: '로블록스 닉네임', value: nicknameValue, inline: false });
    fields.push({ name: '\u200b', value: '\u200b', inline: false });
  }

  if (game) {
    fields.push({ name: '구매하실 게임', value: game, inline: false });
    fields.push({ name: '\u200b', value: '\u200b', inline: false });
  }

  if (gamepass) {
    fields.push({ name: '구매하실 게임패스', value: gamepass, inline: false });
    fields.push({ name: '\u200b', value: '\u200b', inline: false });
  }

  // 입금 안내 필드
  if (accountIndex !== null && accountIndex !== undefined && ACCOUNTS[accountIndex]) {
    const acc = ACCOUNTS[accountIndex];

    fields.push({
      name: '입금 안내',
      value: `아래 계좌로 입금해 주세요.\n\n${acc.bank} \`${acc.number}\` : **${acc.holder}**`,
      inline: false,
    });
  } else {
    fields.push({
      name: '입금 안내',
      value: '⬇️ 아래 드롭다운에서 입금하실 계좌를 선택해주세요.',
      inline: false,
    });
  }

  // 가격 안내 (계좌 선택 전후 모두 표시)
  if (robux !== null && robux !== undefined && !Number.isNaN(robux)) {
    fields.push({ name: '\u200b', value: '\u200b', inline: false });
    fields.push({ name: '💰 결제 금액', value: `**${calculatePrice(robux)}**`, inline: false });
  }

  fields.push({ name: '\u200b', value: '\u200b', inline: false });
  fields.push({
    name: '이중창 인증 필수',
    value: '**이중창이 뭔가요?** <#1508377099847864402> 를 확인하세요.',
    inline: false,
  });

  const embed = new EmbedBuilder()
    .setColor(0xF1C40F)
    .setTitle('구매 안내')
    .addFields(fields)
    .setImage(GIF_URL)
    .setTimestamp();

  if (avatarUrl) embed.setThumbnail(avatarUrl);

  return embed;
}

// ─────────────────────────────────────────
// 계좌 확정 안내 임베드
// 드롭다운에서 계좌를 선택했을 때, 기존 안내 임베드를 수정하는 것과 별개로
// "계좌번호 + 가격"만 딱 모아서 별도 메시지로 한 번 더 보낼 때 사용합니다.
// 계좌번호는 코드블록(```)으로 감싸서 탭/클릭 한 번으로 복사할 수 있게 합니다.
// opts:
//   - robux: 로벅스 수량 (number | null) — 있으면 결제 금액도 함께 표시
//   - accountIndex: 선택된 계좌 인덱스 (number) — 필수. 유효하지 않으면 null 반환
// ─────────────────────────────────────────
function buildAccountConfirmEmbed(opts = {}) {
  const { robux = null, accountIndex = null } = opts;

  const acc = ACCOUNTS[accountIndex];
  if (!acc) return null;

  const fields = [
    { name: '🏦 은행', value: acc.bank, inline: true },
    { name: '👤 예금주', value: acc.holder, inline: true },
    { name: '\u200b', value: '\u200b', inline: false },
    { name: '💳 계좌번호 (눌러서 복사하세요)', value: `\`\`\`${acc.number}\`\`\``, inline: false },
  ];

  if (robux !== null && robux !== undefined && !Number.isNaN(robux)) {
    fields.push({ name: '\u200b', value: '\u200b', inline: false });
    fields.push({ name: '💰 결제 금액', value: `**${calculatePrice(robux)}**`, inline: false });
  }

  return new EmbedBuilder()
    .setColor(0xF1C40F)
    .setTitle('📌 입금 계좌 안내')
    .setDescription(`**${acc.name}** 계좌로 입금해주세요.`)
    .addFields(fields)
    .setTimestamp();
}

module.exports = {
  ACCOUNTS,
  ACCOUNT_SELECT_PREFIX,
  calculatePrice,
  getRobloxUser,
  getRobloxAvatar,
  fetchRobloxProfile,
  buildAccountSelectRow,
  buildGuideEmbed,
  buildAccountConfirmEmbed,
};
