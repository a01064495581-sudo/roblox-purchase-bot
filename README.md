# 로블록스 구매로그 디스코드 봇

## 폴더 구성
```
roblox-purchase-bot/
├── index.js              ← 봇을 켜는 메인 파일
├── deploy-commands.js    ← 슬래시 명령어를 디스코드에 등록하는 스크립트
├── package.json          ← 필요한 라이브러리 목록
├── .env.example          ← 환경변수(토큰) 작성 예시
├── .gitignore            ← GitHub에 올리지 않을 파일 목록
└── commands/
    └── 구매로그.js        ← /구매로그 명령어 실제 내용
```

## 처음 실행하는 법 (로컬 테스트용)

1. 이 폴더 안에 `.env` 파일을 새로 만들고, `.env.example`을 참고해서
   `DISCORD_TOKEN`과 `CLIENT_ID` 값을 실제 값으로 채워주세요.

2. 터미널에서 이 폴더로 이동한 뒤 아래 명령어를 순서대로 실행하세요.

```bash
npm install
node deploy-commands.js
node index.js
```

- `npm install` : 필요한 라이브러리 설치 (최초 1회)
- `node deploy-commands.js` : `/구매로그` 명령어를 디스코드에 등록 (최초 1회, 또는 명령어 내용 수정 시)
- `node index.js` : 봇 실행 (이 창을 끄면 봇도 꺼짐 — 그래서 Railway 같은 호스팅이 필요함)

3. 터미널에 `🤖 [봇이름] 로 로그인 완료!` 메시지가 뜨면 성공이에요.
   디스코드 서버에서 봇이 초록색(온라인)으로 바뀐 걸 확인하세요.

## 주의사항

- `.env` 파일은 절대 GitHub에 올리지 마세요 (이미 `.gitignore`에 등록되어 있어 자동으로 제외됩니다)
- 명령어 내용을 수정한 뒤에는 `node deploy-commands.js`를 다시 실행해야 디스코드에 반영됩니다
- `/구매로그`는 서버 관리자 권한을 가진 멤버만 사용할 수 있습니다
