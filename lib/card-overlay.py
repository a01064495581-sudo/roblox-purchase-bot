"""
card-overlay.py
템플릿 이미지에 구매 정보를 합성해 PNG로 저장하는 스크립트.

사용법:
  python3 card-overlay.py \
    --buyer    "ddddvape" \
    --nickname "kolasdasdas" \
    --passtype "인게임 선물" \
    --game     "그어가2" \
    --robux    "898 로벅스" \
    --price    "6,414원" \
    --id       "7713990991110952652" \
    --date     "2026. 6. 23. AM 11:17:53" \
    --out      "output.png"

좌표 수정 방법:
  아래 COORDS 딕셔너리에서 각 항목의 x, y 값을 픽셀 단위로 조정하면 됩니다.
  이미지 기준 좌상단이 (0, 0), x는 오른쪽, y는 아래 방향입니다.
"""

import argparse, os
from PIL import Image, ImageDraw, ImageFont
import numpy as np

# ── 경로 설정 ──────────────────────────────────────────
BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
FONT_DIR   = os.path.join(BASE_DIR, "..", "assets", "fonts")
TEMPLATE   = os.path.join(BASE_DIR, "..", "assets", "purchase-template.png")

BOLD   = os.path.join(FONT_DIR, "NotoSansKR-Bold.ttf")
MEDIUM = os.path.join(FONT_DIR, "NotoSansKR-Medium.ttf")
REG    = os.path.join(FONT_DIR, "NotoSansKR-Regular.ttf")

# ── 색상 ───────────────────────────────────────────────
WHITE = (255, 255, 255)
GOLD  = (255, 215, 0)
MUTED = (160, 163, 172)

# ── 좌표 & 폰트 설정 ───────────────────────────────────
# x, y : 텍스트 시작 좌표 (픽셀)
# w, h : 지울 사각형 너비/높이 (텍스트보다 넉넉하게)
# font_size : 글자 크기
# color : 글자 색
# align : "left" | "center" (center일 때 cx를 중심으로 정렬)
COORDS = {
    "buyer": {
        "x": 188, "y": 343, "w": 430, "h": 58,
        "font": BOLD, "font_size": 52, "color": WHITE,
    },
    "pass_type": {
        "x": 248, "y": 558, "w": 370, "h": 66,
        "font": BOLD, "font_size": 52, "color": WHITE,
    },
    "game": {
        "x": 840, "y": 560, "w": 310, "h": 64,
        "font": BOLD, "font_size": 52, "color": WHITE,
    },
    "robux": {
        "x": 248, "y": 783, "w": 390, "h": 68,
        "font": BOLD, "font_size": 56, "color": GOLD,
    },
    "price": {
        "x": 855, "y": 786, "w": 310, "h": 64,   # ← x 조정 시 이 값만 바꾸면 됨
        "font": BOLD, "font_size": 56, "color": GOLD,
    },
    "roblox_label": {
        "x": 1145, "y": 338, "w": 0, "h": 28,    # align=center이므로 x가 중심
        "font": REG, "font_size": 30, "color": MUTED, "align": "center",
    },
    "nickname": {
        "x": 1145, "y": 378, "w": 0, "h": 46,    # align=center이므로 x가 중심
        "font": BOLD, "font_size": 44, "color": WHITE, "align": "center",
    },
    "footer": {
        "x": 218, "y": 1042, "w": 960, "h": 46,
        "font": REG, "font_size": 34, "color": MUTED,
    },
}

# ── 렌더링 함수 ────────────────────────────────────────
def render(data: dict, out_path: str):
    img  = Image.open(TEMPLATE).copy()
    arr  = np.array(img)
    draw = ImageDraw.Draw(img)

    def sample_bg(y, x, r=4):
        patch = arr[max(0,y-r):y+r, max(0,x-r):x+r]
        return tuple(patch.mean(axis=(0,1)).astype(int))

    def paint(key, text):
        c    = COORDS[key]
        fnt  = ImageFont.truetype(c["font"], c["font_size"])
        align = c.get("align", "left")

        if align == "center":
            cx = c["x"]
            bb = fnt.getbbox(text)
            tw = bb[2] - bb[0]
            x  = cx - tw // 2
            bg = sample_bg(c["y"] + c["h"]//2, cx)
            draw.rectangle([x-6, c["y"], x+tw+6, c["y"]+c["h"]], fill=bg)
            draw.text((x, c["y"]), text, font=fnt, fill=c["color"])
        else:
            bg = sample_bg(c["y"] + c["h"]//2, c["x"] + c["w"]//2)
            draw.rectangle([c["x"], c["y"], c["x"]+c["w"], c["y"]+c["h"]], fill=bg)
            draw.text((c["x"], c["y"]), text, font=fnt, fill=c["color"])

    paint("buyer",       data["buyer"])
    paint("pass_type",   data["pass_type"])
    paint("game",        data["game"])
    paint("robux",       data["robux"])
    paint("price",       data["price"])
    paint("roblox_label","로블록스")
    paint("nickname",    data["nickname"])
    paint("footer",      f"구매 ID {data['purchase_id']}  ·  {data['date']}")

    img.save(out_path)
    print(f"✅ 저장 완료: {out_path}")


# ── CLI 진입점 ─────────────────────────────────────────
if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--buyer");    p.add_argument("--nickname")
    p.add_argument("--passtype"); p.add_argument("--game")
    p.add_argument("--robux");    p.add_argument("--price")
    p.add_argument("--id");       p.add_argument("--date")
    p.add_argument("--out", default="output.png")
    a = p.parse_args()

    render({
        "buyer":       a.buyer,
        "nickname":    a.nickname,
        "pass_type":   a.passtype,
        "game":        a.game,
        "robux":       a.robux,
        "price":       a.price,
        "purchase_id": a.id,
        "date":        a.date,
    }, a.out)
