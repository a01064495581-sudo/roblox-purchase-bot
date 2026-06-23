// 구매로그 영수증 카드 이미지를 그리는 모듈
// 꿀벌 컨셉 디자인 (노랑/검정)
// 이 파일만 수정하면 디자인이 바뀌고, 구매로그.js 로직에는 영향 없음

const path = require('node:path');
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');

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
    console.error('⚠️ [카드 렌더링] 한글 폰트 등록 실패:', err.message);
  }
}

const CARD_WIDTH  = 780;
const CARD_HEIGHT = 420;

// 꿀벌 컨셉 색상
const COLORS = {
  background:    '#1A1200',
  badgeBg:       '#2E2200',
  stripe:        '#221800',
  accent:        '#FFD700',
  accentNotFound:'#E67E22',
  honey:         '#FFC200',
  divider:       '#4A3800',
  textPrimary:   '#FFFFFF',
  textSecondary: '#C8A800',
};

function drawRoundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawStripeBackground(ctx) {
  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  ctx.save();
  ctx.strokeStyle = COLORS.stripe;
  ctx.lineWidth = 18;
  for (let i = -CARD_HEIGHT; i < CARD_WIDTH + CARD_HEIGHT; i += 36) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + CARD_HEIGHT, CARD_HEIGHT);
    ctx.stroke();
  }
  ctx.restore();

  // 반투명 오버레이
  ctx.fillStyle = 'rgba(26, 18, 0, 0.82)';
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
}

async function renderPurchaseCard(data) {
  ensureFontsRegistered();

  const canvas = createCanvas(CARD_WIDTH, CARD_HEIGHT);
  const ctx = canvas.getContext('2d');

  const accent = data.notFound ? COLORS.accentNotFound : COLORS.accent;

  // 배경
  drawStripeBackground(ctx);

  // 좌측 강조 바
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, 10, CARD_HEIGHT);

  // 타이틀
  ctx.fillStyle = accent;
  ctx.font = `700 28px "${FONT_FAMILY}", sans-serif`;
  ctx.fillText('🍯 구매 완료', 36, 56);

  // 타이틀 구분선
  ctx.strokeStyle = accent;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(36, 66);
  ctx.lineTo(CARD_WIDTH - 36, 66);
  ctx.stroke();

  // 구매자
  ctx.fillStyle = COLORS.textSecondary;
  ctx.font = `400 15px "${FONT_FAMILY}", sans-serif`;
  ctx.fillText('구매자', 36, 100);
  ctx.fillStyle = COLORS.textPrimary;
  ctx.font = `600 24px "${FONT_FAMILY}", sans-serif`;
  ctx.fillText(data.buyerTag, 36, 130);

  // 아바타
  const avatarSize = 100;
  const avatarX = CARD_WIDTH - avatarSize - 36;
  const avatarY = 28;

  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 + 4, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.badgeBg;
  ctx.fill();
  ctx.restore();

  try {
    if (data.avatarUrl) {
      const img = await loadImage(data.avatarUrl);
      ctx.save();
      ctx.beginPath();
      ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(img, avatarX, avatarY, avatarSize, avatarSize);
      ctx.restore();
    }
  } catch (err) {
    console.error('❌ [카드 렌더링] 아바타 이미지 로드 실패:', err.message);
  }

  ctx.beginPath();
  ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.textSecondary;
  ctx.font = `400 13px "${FONT_FAMILY}", sans-serif`;
  ctx.fillText(data.notFound ? '⚠ 못 찾음' : '로블록스', avatarX + avatarSize / 2, avatarY + avatarSize + 20);
  ctx.fillStyle = accent;
  ctx.font = `600 16px "${FONT_FAMILY}", sans-serif`;
  ctx.fillText(data.nickname, avatarX + avatarSize / 2, avatarY + avatarSize + 40);
  ctx.textAlign = 'left';

  // 구분선
  ctx.strokeStyle = COLORS.divider;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(36, 162);
  ctx.lineTo(CARD_WIDTH - 36, 162);
  ctx.stroke();

  // 정보 그리드 2x2
  const gridY = 198;
  const colX  = [36, 410];
  const rowY  = [gridY, gridY + 90];

  function drawInfoBlock(x, y, label, value, valueColor) {
    ctx.fillStyle = COLORS.badgeBg;
    drawRoundedRect(ctx, x, y - 18, 130, 22, 4);
    ctx.fill();

    ctx.fillStyle = COLORS.textSecondary;
    ctx.font = `400 13px "${FONT_FAMILY}", sans-serif`;
    ctx.fillText(label, x + 6, y - 1);

    ctx.fillStyle = valueColor || COLORS.textPrimary;
    ctx.font = `700 27px "${FONT_FAMILY}", sans-serif`;
    ctx.fillText(value, x, y + 33);
  }

  drawInfoBlock(colX[0], rowY[0], '패스 타입', data.passType);
  drawInfoBlock(colX[1], rowY[0], '게임',      data.game);
  drawInfoBlock(colX[0], rowY[1], '로벅스',    `${data.robux.toLocaleString()} R$`);
  drawInfoBlock(colX[1], rowY[1], '가격',       data.price, COLORS.honey);

  // 하단 구분선
  ctx.strokeStyle = COLORS.divider;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(36, CARD_HEIGHT - 52);
  ctx.lineTo(CARD_WIDTH - 36, CARD_HEIGHT - 52);
  ctx.stroke();

  // 푸터
  ctx.fillStyle = COLORS.textSecondary;
  ctx.font = `400 13px "${FONT_FAMILY}", sans-serif`;
  ctx.fillText(`🐝  구매 ID ${data.purchaseId}  ·  ${data.dateText}`, 36, CARD_HEIGHT - 22);

  return canvas.toBuffer('image/png');
}

module.exports = { renderPurchaseCard };
