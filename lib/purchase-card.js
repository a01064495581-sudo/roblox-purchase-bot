// 구매로그 영수증 카드 이미지를 그리는 모듈
// purchase-template.png 위에 텍스트를 합성하는 방식
const path = require('node:path');
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');

const FONT_FAMILY = 'Noto Sans KR';
let fontsRegistered = false;

function ensureFontsRegistered() {
  if (fontsRegistered) return;
  try {
    const fontDir = path.join(__dirname, '..', 'assets', 'fonts');
    GlobalFonts.registerFromPath(path.join(fontDir, 'NotoSansKR-Regular.ttf'),  FONT_FAMILY);
    GlobalFonts.registerFromPath(path.join(fontDir, 'NotoSansKR-Medium.ttf'),   FONT_FAMILY);
    GlobalFonts.registerFromPath(path.join(fontDir, 'NotoSansKR-Bold.ttf'),     FONT_FAMILY);
    fontsRegistered = true;
  } catch (err) {
    console.error('⚠️ [카드 렌더링] 한글 폰트 등록 실패:', err.message);
  }
}

// 템플릿 이미지 크기 (assets/purchase-template.png 기준)
const TMPL_W = 1385;
const TMPL_H = 1136;

// 디스코드에 올릴 최종 출력 크기 (템플릿 절반 → 선명도 유지)
const OUT_W = TMPL_W;
const OUT_H = TMPL_H;

// ── 색상 ──────────────────────────────────────────────
const WHITE = '#FFFFFF';
const GOLD  = '#FFD700';
const MUTED = '#A0A3AC';

// ── 좌표 설정 (템플릿 원본 픽셀 기준) ────────────────
// x, y : 텍스트 시작 좌표
// cw, ch : 배경을 지울 사각형 너비/높이 (텍스트보다 넉넉하게)
// cx : align=center 일 때 중심 x
// size : 폰트 크기
// weight : 폰트 굵기 ('400' | '700')
// color : 글자 색
// align : 'left' | 'center'
const COORDS = {
  buyer: {
    x: 188, y: 343, cw: 430, ch: 58,
    size: 52, weight: '700', color: WHITE,
  },
  pass_type: {
    x: 248, y: 558, cw: 370, ch: 66,
    size: 52, weight: '700', color: WHITE,
  },
  game: {
    x: 840, y: 560, cw: 310, ch: 64,
    size: 52, weight: '700', color: WHITE,
  },
  robux: {
    x: 248, y: 783, cw: 390, ch: 68,
    size: 56, weight: '700', color: GOLD,
  },
  price: {
    x: 855, y: 786, cw: 310, ch: 64,
    size: 56, weight: '700', color: GOLD,
  },
  roblox_label: {
    cx: 1145, y: 338, ch: 28,
    size: 30, weight: '400', color: MUTED, align: 'center',
  },
  nickname: {
    cx: 1145, y: 378, ch: 46,
    size: 44, weight: '700', color: WHITE, align: 'center',
  },
  footer: {
    x: 218, y: 1042, cw: 960, ch: 46,
    size: 34, weight: '400', color: MUTED,
  },
};

// 텍스트가 maxW를 넘으면 말줄임표 처리
function truncate(ctx, text, maxW) {
  if (!maxW || ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 0 && ctx.measureText(t + '…').width > maxW) {
    t = t.slice(0, -1);
  }
  return t + '…';
}

async function renderPurchaseCard(data) {
  ensureFontsRegistered();

  const canvas = createCanvas(OUT_W, OUT_H);
  const ctx    = canvas.getContext('2d');

  // ── 1. 템플릿 이미지 그리기 ──
  const templatePath = path.join(__dirname, '..', 'assets', 'purchase-template.png');
  try {
    const tmpl = await loadImage(templatePath);
    ctx.drawImage(tmpl, 0, 0, OUT_W, OUT_H);
  } catch (err) {
    console.error('❌ [카드 렌더링] 템플릿 이미지 로드 실패:', err.message);
    throw err; // 템플릿 없으면 의미 없으므로 throw
  }

  // ── 2. 아바타 합성 (우측 원형 영역) ──
  // 템플릿에 이미 원형 테두리가 그려져 있으므로 이미지만 clip해서 올림
  // 아바타 원의 중심/반지름 (템플릿 좌표 기준)
  const avatarCX = 1145;
  const avatarCY = 220;
  const avatarR  = 105;

  if (data.avatarUrl) {
    try {
      const avatarImg = await loadImage(data.avatarUrl);
      ctx.save();
      ctx.beginPath();
      ctx.arc(avatarCX, avatarCY, avatarR, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(
        avatarImg,
        avatarCX - avatarR, avatarCY - avatarR,
        avatarR * 2, avatarR * 2
      );
      ctx.restore();
    } catch (err) {
      console.error('❌ [카드 렌더링] 아바타 로드 실패 (기본 상태 유지):', err.message);
    }
  }

  // ── 3. 텍스트 paint 헬퍼 ──
  // 배경색 샘플링 → 해당 영역을 덮어 지운 뒤 → 텍스트 렌더링
  function sampleBg(cx, cy, r = 6) {
    try {
      const px = ctx.getImageData(
        Math.max(0, Math.round(cx) - r),
        Math.max(0, Math.round(cy) - r),
        r * 2, r * 2
      );
      let rs = 0, gs = 0, bs = 0, as = 0, n = 0;
      for (let i = 0; i < px.data.length; i += 4) {
        rs += px.data[i];
        gs += px.data[i + 1];
        bs += px.data[i + 2];
        as += px.data[i + 3];
        n++;
      }
      return `rgba(${Math.round(rs/n)},${Math.round(gs/n)},${Math.round(bs/n)},${(as/n/255).toFixed(2)})`;
    } catch {
      return '#1E1F22';
    }
  }

  function paint(key, text) {
    const c = COORDS[key];
    const isCenter = c.align === 'center';

    ctx.font = `${c.weight} ${c.size}px "${FONT_FAMILY}", sans-serif`;

    if (isCenter) {
      const tw = ctx.measureText(text).width;
      const x  = c.cx - tw / 2;
      const bg = sampleBg(c.cx, c.y + c.ch / 2);
      ctx.fillStyle = bg;
      ctx.fillRect(x - 8, c.y, tw + 16, c.ch);
      ctx.fillStyle = c.color;
      ctx.fillText(text, x, c.y + c.ch * 0.78);
    } else {
      const maxW = c.cw;
      const txt  = truncate(ctx, text, maxW);
      const bg   = sampleBg(c.x + c.cw / 2, c.y + c.ch / 2);
      ctx.fillStyle = bg;
      ctx.fillRect(c.x, c.y, c.cw, c.ch);
      ctx.fillStyle = c.color;
      ctx.fillText(txt, c.x, c.y + c.ch * 0.78);
    }
  }

  // ── 4. 각 필드 렌더링 ──
  paint('buyer',       data.buyerTag);
  paint('pass_type',   data.passType);
  paint('game',        data.game);
  paint('robux',       `${Number(data.robux).toLocaleString('ko-KR')} 로벅스`);
  paint('price',       data.price);
  paint('roblox_label', data.notFound ? '유저 못 찾음' : '로블록스');
  paint('nickname',    data.nickname);
  paint('footer',      `구매 ID ${data.purchaseId}  ·  ${data.dateText}`);

  return canvas.toBuffer('image/png');
}

module.exports = { renderPurchaseCard };
