import { Telegraf } from 'telegraf';
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();

const bot = new Telegraf(process.env.BOT_TOKEN);

const prisma = new PrismaClient();

// Get or create user
async function getUser(telegramId: number, username: string) {
  let user = await prisma.user.findUnique({
    where: { telegramId },
  });

  if (!user) {
    user = await prisma.user.create({
      data: { telegramId, username },
    });
  }

  return user;
}

bot.start(async (ctx) => {
  const user = await getUser(ctx.from.id, ctx.from.username || 'unknown');
  ctx.reply(
    `Hello ${ctx.from.username}, welcome to the bot! Your current score is ${user.score}`,
  );
});

bot.command('login', async (ctx) => {
  const user = await getUser(ctx.from.id, ctx.from.username || 'unknown');

  // Check if user already logged in today
  const today = new Date();
  const lastLogin = user.lastLogin ? new Date(user.lastLogin) : null;

  if (lastLogin && today.toDateString() === lastLogin.toDateString()) {
    ctx.reply("You've already logged in today.");
  } else {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        lastLogin: today,
        score: user.score + 5,
      },
    });
    ctx.reply("You've logged in and earned 5 points!");
  }
});

bot.command('score', async (ctx) => {
  const user = await getUser(ctx.from.id, ctx.from.username || 'unknown');

  ctx.reply(`Your current score is: ${user.score}`);
});

bot.command('leaderboard', async (ctx) => {
  const topUsers = await prisma.user.findMany({
    orderBy: { score: 'desc' },
    take: 5,
  });

  let leaderboard = 'Leaderboard:\n';
  topUsers.forEach((user, index) => {
    leaderboard += `${index + 1}. ${user.username} - ${user.score} points\n`;
  });

  ctx.reply(leaderboard);
});

// Text Handler
bot.on('text', async (ctx) => {
  if (!ctx.message.text) return;

  const user = await getUser(ctx.from.id, ctx.from.username || 'unknown');

  // It is better to us AI here to detect spam messages
  const repetitive = ['gm', 'gn'].includes(ctx.message.text.toLowerCase());
  if (repetitive) {
    await prisma.user.update({
      where: { id: user.id },
      data: { score: user.score - 1 },
    });
    ctx.reply('Repetitive message detected. You lost 1 point.');
  } else if (ctx.message.text.length > 10) {
    // Adding points for long messages
    await prisma.user.update({
      where: { id: user.id },
      data: { score: user.score + 1 },
    });

    // Add message to the database
    await prisma.message.create({
      data: {
        content: ctx.message.text,
        userId: user.id,
      },
    });
  }
});

bot
  .launch()
  .then(() => {
    console.log('Bot started!');
  })
  .catch((error) => {
    console.error('Error starting bot:', error);
  });
