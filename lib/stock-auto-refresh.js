// lib/stock-auto-refresh.js
// 10분마다 .env의 ROBLOX_COOKIE 계정에서 실제 로벅스 잔액을 조회해서
// 실시간재고 임베드의 "로벅스 재고" 숫자만 자동으로 갱신합니다.
// (처리가능여부 / 지급방식은 마지막으로 /실시간재고 명령어에서 설정한 값을 그대로 유지)
//
// ⚠️ 이 기능이 작동하려면, 먼저 /실시간재고 명령어를 한 번 실행해서
//    처리가능여부/지급방식을 설정해둬야 해요.

const { fetchRobuxBalance } = require('./roblox-balance');
const { readState, writeState } = require('./stock-state');
const stockCommand = require('../commands/실시간재고');


const REFRESH_INTERVAL_MS = 10 * 60 * 1000; // 10분
let intervalHandle = null;

async function refreshOnce(client) {
  const state = readState();

  if (!state) {
    console.warn('⚠️ [재고자동갱신] 아직 /실시간재고 명령어를 한 번도 실행하지 않았어요. 먼저 한 번 실행해서 처리가능여부/지급방식을 설정해주세요.');
    return;
  }

  let robux;
  try {
    robux = await fetchRobuxBalance();
  } catch (err) {
    console.error('❌ [재고자동갱신] 로벅스 잔액 조회 실패:', err.message);
    return;
  }

  try {
    await stockCommand.sendOrEditStockEmbed(client, {
      robux,
      available: state.available,
      selectedValues: state.selectedValues,
    });
    writeState({ ...state, robux, updatedAt: Date.now() });
    console.log(`🔄 [재고자동갱신] 로벅스 재고 자동 갱신 완료: ${robux.toLocaleString('ko-KR')} R$`);
  } catch (err) {
    console.error('❌ [재고자동갱신] 임베드 업데이트 실패:', err.message);
  }
}

function startStockAutoRefresh(client) {
  if (intervalHandle) return; // 중복 시작 방지

  if (!process.env.ROBLOX_COOKIE) {
    console.warn('⚠️ [재고자동갱신] ROBLOX_COOKIE가 없어서 자동 갱신을 시작하지 않아요. (.env에 추가하면 자동으로 활성화돼요)');
    return;
  }

  refreshOnce(client); // 봇 시작하자마자 1회 즉시 실행
  intervalHandle = setInterval(() => refreshOnce(client), REFRESH_INTERVAL_MS);

  console.log('🌀 [재고자동갱신] 스케줄러 시작됨 (10분마다 로블록스 로벅스 잔액 자동 반영)');
}

function stopStockAutoRefresh() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}

module.exports = { startStockAutoRefresh, stopStockAutoRefresh };
