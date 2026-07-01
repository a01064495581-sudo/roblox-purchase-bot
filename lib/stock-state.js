// lib/stock-state.js
// /실시간재고 명령어로 마지막에 설정한 값(처리가능여부, 지급방식)을 파일로 저장해둡니다.
// 10분마다 자동으로 로벅스 숫자만 갱신할 때, 이 파일에서 나머지 값을 그대로 불러와 재사용합니다.

const fs = require('node:fs');
const path = require('node:path');

const STATE_FILE = path.join(__dirname, '..', 'data', 'stock-state.json');

function ensureDataDir() {
  const dir = path.dirname(STATE_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/**
 * 저장된 상태를 읽어옵니다. 저장된 게 없으면 null을 반환합니다.
 * @returns {{ robux: number, available: string, selectedValues: string[], updatedAt: number } | null}
 */
function readState() {
  try {
    ensureDataDir();
    if (!fs.existsSync(STATE_FILE)) return null;
    const raw = fs.readFileSync(STATE_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.warn('⚠️ [재고상태] 저장된 상태 읽기 실패:', err.message);
    return null;
  }
}

function writeState(state) {
  try {
    ensureDataDir();
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
  } catch (err) {
    console.warn('⚠️ [재고상태] 상태 저장 실패:', err.message);
  }
}

module.exports = { readState, writeState };
