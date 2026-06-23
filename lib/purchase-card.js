// 구매로그 영수증 카드 이미지를 그리는 모듈
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

const CARD_WIDTH  = 680;
const CARD_HEIGHT = 560;

const COLORS = {
  background:     '#1E1F22',
  panel:          '#2B2D31',
  panelAccent:    '#2E2A14',
  accentFound:    '#FFD700',
  accentNotFound: '#E67E22',
  textPrimary:    '#FFFFFF',
  textSecondary:  '#B5BAC1',
  textMuted:      '#80848E',
  divider:        '#3A3C41',
};

function line(ctx, x1, y1, x2, y2, color = COLORS.divider, width = 1) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth   = width;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

async function renderPurchaseCard(data) {
  ensureFontsRegistered();

  const canvas = createCanvas(CARD_WIDTH, CARD_HEIGHT);
  const ctx    = canvas.getContext('2d');
  const accent = data.notFound ? COLORS.accentNotFound : COLORS.accentFound;
  const PAD    = 40;

  // ── 배경 ──
  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  // 좌측 강조 바 (8px)
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, 8, CARD_HEIGHT);

  // ── 상단 헤더 영역 ──
  // 타이틀
  ctx.fillStyle = accent;
  ctx.font      = `700 24px "${FONT_FAMILY}", sans-serif`;
  ctx.fillText('구매 완료', PAD, 52);

  // 아바타 (우측, 크게)
  const avatarSize = 100;
  const avatarCX   = CARD_WIDTH - PAD - avatarSize / 2;
  const avatarCY   = 70;

  try {
    if (data.avatarUrl) {
      const img = await loadImage(data.avatarUrl);
      ctx.save();
      ctx.beginPath();
      ctx.arc(avatarCX, avatarCY, avatarSize / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(img, avatarCX - avatarSize / 2, avatarCY - avatarSize / 2, avatarSize, avatarSize);
      ctx.restore();
    }
  } catch (err) {
    console.error('❌ [카드 렌더링] 아바타 로드 실패:', err.message);
  }

  // 아바타 테두리
  ctx.beginPath();
  ctx.arc(avatarCX, avatarCY, avatarSize / 2, 0, Math.PI * 2);
  ctx.strokeStyle = accent;
  ctx.lineWidth   = 3;
  ctx.stroke();

  // 로블록스 라벨
  ctx.textAlign   = 'center';
  ctx.fillStyle   = COLORS.textMuted;
  ctx.font        = `400 12px "${FONT_FAMILY}", sans-serif`;
  ctx.fillText(data.notFound ? '유저 못 찾음' : '로블록스', avatarCX, avatarCY + avatarSize / 2 + 20);
  // 로블록스 닉네임
  ctx.fillStyle = COLORS.textPrimary;
  ctx.font      = `600 15px "${FONT_FAMILY}", sans-serif`;
  ctx.fillText(data.nickname, avatarCX, avatarCY + avatarSize / 2 + 40);
  ctx.textAlign = 'left';

  // 구매자 라벨 + 값
  ctx.fillStyle = COLORS.textMuted;
  ctx.font      = `400 13px "${FONT_FAMILY}", sans-serif`;
  ctx.fillText('구매자', PAD, 90);
  ctx.fillStyle = COLORS.textPrimary;
  ctx.font      = `700 20px "${FONT_FAMILY}", sans-serif`;
  ctx.fillText(data.buyerTag, PAD, 116);

  // 구분선 1 (헤더 아래) — 아바타 닉네임보다 아래에 배치
  const div1Y = avatarCY + avatarSize / 2 + 60;
  line(ctx, PAD, div1Y, CARD_WIDTH - PAD, div1Y);

  // ── 정보 블록 ──
  const blockW  = (CARD_WIDTH - PAD * 2 - 16) / 2;
  const blockH  = 82;
  const blockGap = 16;
  const startY  = div1Y + 20;

  function drawBlock(col, row, label, value, highlight = false) {
    const x = PAD + col * (blockW + blockGap);
    const y = startY + row * (blockH + blockGap);

    ctx.fillStyle = highlight ? COLORS.panelAccent : COLORS.panel;
    ctx.beginPath();
    ctx.roundRect(x, y, blockW, blockH, 10);
    ctx.fill();

    if (highlight) {
      ctx.strokeStyle = accent + '66';
      ctx.lineWidth   = 1.5;
      ctx.beginPath();
      ctx.roundRect(x, y, blockW, blockH, 10);
      ctx.stroke();
    }

    ctx.fillStyle = COLORS.textMuted;
    ctx.font      = `400 12px "${FONT_FAMILY}", sans-serif`;
    ctx.fillText(label, x + 16, y + 24);

    ctx.fillStyle = highlight ? accent : COLORS.textPrimary;
    ctx.font      = `700 20px "${FONT_FAMILY}", sans-serif`;
    ctx.fillText(value, x + 16, y + 58);
  }

  drawBlock(0, 0, '패스 타입', data.passType);
  drawBlock(1, 0, '게임', data.game);
  drawBlock(0, 1, '로벅스', `${data.robux.toLocaleString()} 로벅스`, true);
  drawBlock(1, 1, '가격', data.price, true);

  // 구분선 2 (푸터 위)
  const div2Y = CARD_HEIGHT - 64;
  line(ctx, PAD, div2Y, CARD_WIDTH - PAD, div2Y);

  // ── 푸터 ──
  ctx.fillStyle = COLORS.textMuted;
  ctx.font      = `400 12px "${FONT_FAMILY}", sans-serif`;
  ctx.fillText(`구매 ID ${data.purchaseId}  ·  ${data.dateText}`, PAD, CARD_HEIGHT - 32);

  return canvas.toBuffer('image/png');
}

module.exports = { renderPurchaseCard };
