// 봇을 실행하는 메인 파일입니다. Render는 이 파일을 실행해서 봇을 켭니다.

require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
const { checkBumpMessage } = require('./commands/bump-reminder.js');

// Render는 Web Service가 특정 포트에서 응답해야 배포를 "성공"으로 인식합니다.
// 디스코드 봇 자체는 포트가 필요 없지만, 이 더미 서버를 띄워서 Render의 포트 감지를 통과시킵니다.
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bot is running');
}).listen(PORT, () => {
  console.log(`🌐 더미 웹서버가 포트 ${PORT}에서 실행 중입니다. (Render 포트 감지용)`);
});

// Render 무료 플랜은 15분간 외부 요청이 없으면 슬립 모드로 들어갑니다.
// 14분마다 우리 서비스 자신에게 HTTP 요청을 보내서 슬립을 방지합니다.
// RENDER_EXTERNAL_URL은 Render가 자동으로 제공하는 이 서비스의 공개 URL 환경변수입니다.
const SELF_PING_INTERVAL_MS = 14 * 60 * 1000;
if (process.env.RENDER_EXTERNAL_URL) {
  setInterval(() => {
    http.get(process.env.RENDER_EXTERNAL_URL, (res) => {
      console.log(`🏓 self-ping 완료 (status: ${res.statusCode})`);
    }).on('error', (err) => {
      console.error('❌ self-ping 실패:', err.message);
    });
  }, SELF_PING_INTERVAL_MS);
} else {
  console.warn('⚠️ RENDER_EXTERNAL_URL이 없어서 self-ping을 설정하지 못했어요. (로컬 환경이거나 Render 외부에서 실행 중일 수 있어요)');
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
  ],
});

// commands 폴더 안의 모든 명령어 파일을 자동으로 읽어서 등록
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

const commandData = [];

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);

  if ('data' in command && 'execute' in command) {
    client.commands.set(command.data.name, command);
    commandData.push(command.data.toJSON());
    console.log(`✅ 명령어 로드됨: ${command.data.name}`);
  } else {
    console.warn(`⚠️ ${file} 파일에 data 또는 execute가 없어서 건너뜁니다.`);
  }
}

// 봇이 켜질 때마다 슬래시 명령어를 디스코드에 자동으로 등록
// (Shell 없이도 명령어가 항상 최신 상태로 유지되도록)
async function registerSlashCommands() {
  if (!process.env.CLIENT_ID) {
    console.warn('⚠️ CLIENT_ID가 없어서 슬래시 명령어를 등록하지 못했어요.');
    return;
  }
  try {
    const rest = new REST().setToken(process.env.DISCORD_TOKEN);
    console.log(`🔄 ${commandData.length}개의 슬래시 명령어를 등록하는 중...`);
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commandData },
    );
    console.log('✅ 슬래시 명령어 등록 완료!');
  } catch (err) {
    console.error('❌ 슬래시 명령어 등록 중 오류:', err);
  }
}

// 봇이 켜졌을 때 한 번 실행
client.once('ready', async () => {
  console.log(`🤖 ${client.user.tag} 로 로그인 완료! 봇이 온라인 상태입니다.`);
  await registerSlashCommands();
});

// 슬래시 명령어 실행 + 버튼/모달 상호작용 처리
client.on('interactionCreate', async (interaction) => {
  // 1) 슬래시 명령어 실행
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) {
      console.warn(`알 수 없는 명령어: ${interaction.commandName}`);
      return;
    }
    try {
      await command.execute(interaction);
    } catch (err) {
      console.error(`명령어 실행 중 오류 (${interaction.commandName}):`, err);
      const errorReply = { content: '⚠️ 명령어 실행 중 오류가 발생했어요.', ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorReply).catch(() => {});
      } else {
        await interaction.reply(errorReply).catch(() => {});
      }
    }
    return;
  }

  // 2) 버튼 클릭 또는 모달 제출 (구매로그 봇의 "닉네임 다시 입력" 기능)
  if (interaction.isButton() || interaction.isModalSubmit()) {
    if (
      interaction.customId.startsWith('retry_nick') ||
      interaction.customId.startsWith('submit_nick')
    ) {
      const purchaseLogCommand = client.commands.get('구매로그');
      if (purchaseLogCommand?.handleComponent) {
        try {
          await purchaseLogCommand.handleComponent(interaction);
        } catch (err) {
          console.error('버튼/모달 처리 중 오류:', err);
        }
      }
    }
  }
});

// 일반 메시지 감지 (현재는 /bump 리마인더 용도로만 사용)
client.on('messageCreate', async (message) => {
  try {
    await checkBumpMessage(message);
  } catch (err) {
    console.error('bump 리마인더 처리 중 오류:', err);
  }
});

// 디스코드 토큰으로 실제 로그인 (봇 켜기)
if (!process.env.DISCORD_TOKEN) {
  console.error('❌ .env 파일에 DISCORD_TOKEN이 없어요.');
  process.exit(1);
}

client.login(process.env.DISCORD_TOKEN);
