// 이 파일은 "/구매로그" 같은 슬래시 명령어를 디스코드에 등록하는 스크립트입니다.
// 봇을 처음 실행하기 전에, 또는 명령어 내용을 수정했을 때 한 번씩 실행해주세요.
// 실행 방법: node deploy-commands.js

require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const { REST, Routes } = require('discord.js');

const commands = [];
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  if ('data' in command) {
    commands.push(command.data.toJSON());
  }
}

if (!process.env.DISCORD_TOKEN || !process.env.CLIENT_ID) {
  console.error('❌ .env 파일에 DISCORD_TOKEN 또는 CLIENT_ID가 없어요. .env.example을 참고해서 .env 파일을 만들어주세요.');
  process.exit(1);
}

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log(`🔄 ${commands.length}개의 슬래시 명령어를 등록하는 중...`);

    // 모든 서버에 공통으로 등록 (전파에 최대 1시간 정도 걸릴 수 있음)
    const data = await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands },
    );

    console.log(`✅ ${data.length}개의 슬래시 명령어 등록 완료!`);
  } catch (error) {
    console.error('❌ 명령어 등록 중 오류:', error);
  }
})();
