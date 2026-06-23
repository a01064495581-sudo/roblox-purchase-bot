// 구매로그 영수증 카드 이미지를 그리는 모듈
// @napi-rs/canvas를 사용해 매번 같은 디자인(틀)에 정보만 채워서 PNG로 렌더링합니다.
// 디자인(레이아웃/색상/폰트)은 고정이고, 닉네임/게임/가격 등 텍스트만 매번 달라집니다.
//
// 이 파일은 구매로그.js와 분리되어 있어, 카드 디자인을 바꿔도 구매로그.js의
// 파싱/버튼/모달 로직에는 영향이 없습니다.

const path = require('node:path');
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');

// 한글 폰트를 직접 등록합니다.
// 서버(디스호스트 등) 환경에 시스템 한글 폰트가 없는 경우가 많아서,
// 폰트 파일을 프로젝트에 직접 포함시켜 등록합니다. (assets/fonts 폴더)
// 한 번만 등록하면 되므로 모듈이 처음 로드될 때 한 번 실행합니다.
const FONT_FAMILY = 'Noto Sans KR';
let fontsRegistered = false;

function ensureFontsRegistered() {
  if (fontsRegistered) return;
  try {
    const fontDir = path.join(__dirname, '..', 'assets', 'fonts');
    GlobalFonts.registerFromPath(path.join(fontDir, 'NotoSansKR-Regular.ttf'), FONT_FAMILY);
    GlobalFonts.registerFromPath(path.join(fontDir, 'NotoSansKR-Medium.ttf'), FONT_FAMILY);
    GlobalFonts.registerFromPath(path.join(fontDir, 'NotoSansKR-Bold.ttf'), FONT_FAMILY);
    fontsRegistered = true;
  } catch (err) {
    console.error('⚠️ [카드 렌더링] 한글 폰트 등록 실패 (기본 폰트로 대체됨, 한글이 깨질 수 있음):', err.message);
  }
}

const CARD_WIDTH = 700;
const CARD_HEIGHT = 360;

// 색상 (구매자 닉네임을 못 찾은 경우 주황, 정상인 경우 골드 계열 유지)
const COLORS = {
  background: '#2B2D31', // 디스코드 다크 테마와 어울리는 배경
  card: '#1E1F22',
  accentFound: '#F1C40F',
  accentNotFound: '#E67E22',
  textPrimary: '#FFFFFF',
  textSecondary: '#B5BAC1',
  divider: '#3A3C41',
};

function drawRoundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

/**
 * 구매 정보를 받아서 영수증 카드 PNG 버퍼를 반환합니다.
 * @param {Object} data
 * @param {string} data.buyerTag - 구매자 디스코드 태그 (예: "유저#1234" 또는 username)
 * @param {string} data.nickname - 로블록스 닉네임
 * @param {string|null} data.avatarUrl - 로블록스 아바타 이미지 URL (없으면 null)
 * @param {boolean} data.notFound - 로블록스 유저를 못 찾았는지 여부
 * @param {string} data.passType - 패스 타입
 * @param {string} data.game - 게임 이름
 * @param {number} data.robux - 로벅스 수량
 * @param {string} data.price - 가격 (예: "7,000원")
 * @param {string} data.purchaseId - 구매 ID
 * @param {string} data.dateText - 표시할 날짜/시간 문자열
 * @returns {Promise<Buffer>} PNG 이미지 버퍼
 */
async function renderPurchaseCard(data) {
  ensureFontsRegistered();

  const canvas = createCanvas(CARD_WIDTH, CARD_HEIGHT);
  const ctx = canvas.getContext('2d');

  const accent = data.notFound ? COLORS.accentNotFound : COLORS.accentFound;

  // 배경
  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  // 좌측 강조 색상 바 (8px)
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, 8, CARD_HEIGHT);

  // 상단 라벨
  ctx.fillStyle = accent;
  ctx.font = '600 22px "Noto Sans KR", sans-serif';
  ctx.fillText('✓ 구매 완료', 40, 50);

  // 구매자 정보
  ctx.fillStyle = COLORS.textSecondary;
  ctx.font = '400 15px "Noto Sans KR", sans-serif';
  ctx.fillText('구매자', 40, 95);
  ctx.fillStyle = COLORS.textPrimary;
  ctx.font = '500 20px "Noto Sans KR", sans-serif';
  ctx.fillText(data.buyerTag, 40, 122);

  // 아바타 이미지 (우측 상단, 동그랗게 클리핑)
  const avatarSize = 90;
  const avatarX = CARD_WIDTH - avatarSize - 40;
  const avatarY = 35;

  try {
    if (data.avatarUrl) {
      const img = await loadImage(data.avatarUrl);
      ctx.save();
      ctx.beginPath();
      ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(img, avatarX, avatarY, avatarSize, avatarSize);
      ctx.restore();
    }
  } catch (err) {
    console.error('❌ [카드 렌더링] 아바타 이미지 로드 실패:', err.message);
  }

  // 아바타 테두리 (이미지 로드 성공/실패와 무관하게 항상 그림)
  ctx.beginPath();
  ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 3;
  ctx.stroke();

  // 로블록스 닉네임 (아바타 아래)
  ctx.fillStyle = COLORS.textSecondary;
  ctx.font = '400 13px "Noto Sans KR", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(data.notFound ? '⚠ 못 찾음' : '로블록스', avatarX + avatarSize / 2, avatarY + avatarSize + 20);
  ctx.fillStyle = COLORS.textPrimary;
  ctx.font = '500 15px "Noto Sans KR", sans-serif';
  ctx.fillText(data.nickname, avatarX + avatarSize / 2, avatarY + avatarSize + 40);
  ctx.textAlign = 'left';

  // 구분선
  ctx.strokeStyle = COLORS.divider;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(40, 160);
  ctx.lineTo(CARD_WIDTH - 40, 160);
  ctx.stroke();

  // 정보 그리드 (패스타입 / 게임 / 로벅스 / 가격) - 2x2
  const gridStartY = 195;
  const colX = [40, 380];
  const rowY = [gridStartY, gridStartY + 75];

  function drawInfoBlock(x, y, label, value) {
    ctx.fillStyle = COLORS.textSecondary;
    ctx.font = '400 14px "Noto Sans KR", sans-serif';
    ctx.fillText(label, x, y);
    ctx.fillStyle = COLORS.textPrimary;
    ctx.font = '500 22px "Noto Sans KR", sans-serif';
    ctx.fillText(value, x, y + 28);
  }

  drawInfoBlock(colX[0], rowY[0], '패스 타입', data.passType);
  drawInfoBlock(colX[1], rowY[0], '게임', data.game);
  drawInfoBlock(colX[0], rowY[1], '로벅스', `${data.robux.toLocaleString()} R$`);
  drawInfoBlock(colX[1], rowY[1], '가격', data.price);

  // 하단 구분선
  ctx.strokeStyle = COLORS.divider;
  ctx.beginPath();
  ctx.moveTo(40, CARD_HEIGHT - 55);
  ctx.lineTo(CARD_WIDTH - 40, CARD_HEIGHT - 55);
  ctx.stroke();

  // 푸터: 구매 ID + 시간
  ctx.fillStyle = COLORS.textSecondary;
  ctx.font = '400 13px "Noto Sans KR", sans-serif';
  ctx.fillText(`구매 ID ${data.purchaseId} · ${data.dateText}`, 40, CARD_HEIGHT - 28);

  return canvas.toBuffer('image/png');
}

module.exports = { renderPurchaseCard };
