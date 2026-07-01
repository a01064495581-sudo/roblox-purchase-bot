// lib/roblox-balance.js
// 로블록스 "내 계정"의 실시간 로벅스 잔액을 조회합니다.
// (남의 계정이 아니라, .env에 넣은 쿠키 주인의 계정 잔액만 조회할 수 있어요)
//
// ✅ 사용법: .env 파일에 아래 항목을 추가하세요.
//   ROBLOX_COOKIE=여기에 .ROBLOSECURITY 쿠키 값 통째로 붙여넣기

const AUTH_USER_URL = 'https://users.roblox.com/v1/users/authenticated';
const CURRENCY_URL = (userId) => `https://economy.roblox.com/v1/users/${userId}/currency`;

// 매번 "내 계정 정보"를 조회하지 않도록 userId만 캐싱 (쿠키가 바뀌거나 만료되면 초기화됨)
let cachedUserId = null;

function cookieHeader(cookie) {
  return { Cookie: `.ROBLOSECURITY=${cookie}` };
}

async function fetchAuthenticatedUserId(cookie) {
  const res = await fetch(AUTH_USER_URL, { headers: cookieHeader(cookie) });

  if (res.status === 401) {
    throw new Error(
      'ROBLOX_COOKIE가 만료됐거나 잘못됐어요. 로블록스에 다시 로그인해서 .ROBLOSECURITY 쿠키를 새로 발급받아 .env에 갱신해주세요.'
    );
  }
  if (!res.ok) {
    throw new Error(`로블록스 계정 확인 실패 (status: ${res.status})`);
  }

  const data = await res.json();
  return data.id; // { id, name, displayName }
}

/**
 * .env의 ROBLOX_COOKIE 주인 계정의 현재 로벅스 잔액을 가져옵니다.
 * @returns {Promise<number>} 로벅스 수량
 */
async function fetchRobuxBalance() {
  const cookie = process.env.ROBLOX_COOKIE;
  if (!cookie) {
    throw new Error('.env 파일에 ROBLOX_COOKIE가 설정되어 있지 않아요.');
  }

  if (!cachedUserId) {
    cachedUserId = await fetchAuthenticatedUserId(cookie);
  }

  let res = await fetch(CURRENCY_URL(cachedUserId), { headers: cookieHeader(cookie) });

  // 쿠키가 그 사이 만료됐을 수도 있으니, 401이면 캐시를 지우고 한 번만 재시도
  if (res.status === 401) {
    cachedUserId = null;
    cachedUserId = await fetchAuthenticatedUserId(cookie);
    res = await fetch(CURRENCY_URL(cachedUserId), { headers: cookieHeader(cookie) });
  }

  if (!res.ok) {
    throw new Error(`로벅스 잔액 조회 실패 (status: ${res.status})`);
  }

  const data = await res.json();
  if (typeof data.robux !== 'number') {
    throw new Error('로벅스 잔액 응답 형식이 예상과 달라요.');
  }

  return data.robux;
}

module.exports = { fetchRobuxBalance };
