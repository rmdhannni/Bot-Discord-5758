'use strict';

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { getAllRobuxProducts, getAllRedfingerProducts } = require('../database.js');
const fs   = require('fs');
const path = require('path');

// ─────────────────────────────────────────────────────────────────────────────
// PERSISTENT STORAGE — menyimpan daftar live message agar survive restart
// ─────────────────────────────────────────────────────────────────────────────
const LIVE_FILE = path.join(__dirname, '../livestock.json');

function readLive() {
  try {
    if (!fs.existsSync(LIVE_FILE)) return {};
    return JSON.parse(fs.readFileSync(LIVE_FILE, 'utf8'));
  } catch { return {}; }
}

function writeLive(data) {
  fs.writeFileSync(LIVE_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// ─────────────────────────────────────────────────────────────────────────────
// SINGLE GLOBAL INTERVAL — satu setInterval untuk SEMUA live messages.
// Menggantikan satu interval per-message yang sebelumnya menyebabkan banjir
// API request ke Discord setiap 5 detik.
// ─────────────────────────────────────────────────────────────────────────────
const UPDATE_INTERVAL_MS  = 30_000; // update setiap 30 detik (lebih hemat rate limit)
const ORDER_CHANNEL_ID    = '1460489825911050355';

// Map<messageId, discord.Message>
const liveMessages = new Map();
let   globalTimer  = null;

// ─────────────────────────────────────────────────────────────────────────────
// EMBED BUILDERS
// ─────────────────────────────────────────────────────────────────────────────

function formatProducts(products, showPrice) {
  if (!products || products.length === 0)
    return '```diff\n- Belum ada produk tersedia\n```';

  return products.map((p, i) => {
    const id        = String(p.id).toUpperCase();
    const indicator = p.stock === 0
      ? '<a:emoji_27:1467263227464253704> not ready'
      : p.stock <= 5
        ? '🟡 low stock'
        : '<a:emoji_49:1472554810539642971> ready';

    let line =
      ` <:emoji_52:1478397740831477789> **${p.name}**\n` +
      ` <:emoji_72:1480198516721586176> **ID** : __${id}__\n` +
      ` <:emoji_72:1480198516721586176> **Status** : ${indicator}\n` +
      ` <:emoji_72:1480198516721586176> **Stock** : ${p.stock.toLocaleString('id-ID')}` +
      (p.stock === 0 ? ' ❌' : p.stock <= 5 ? ' ⚠️' : '') + '\n';

    if (showPrice && p.price > 0)
      line += ` <:emoji_72:1480198516721586176> **Price** : Rp ${p.price.toLocaleString('id-ID')}\n`;

    line += ` <:emoji_71:1480198498270838998> **Sold** : ${p.sold.toLocaleString('id-ID')}`;
    return line;
  }).join('\n\n');
}

function buildEmbed(type, guildId) {
  const now      = Math.floor(Date.now() / 1000);
  const products = type === 'robux' ? getAllRobuxProducts() : getAllRedfingerProducts();
  const orderUrl = `https://discord.com/channels/${guildId}/${ORDER_CHANNEL_ID}`;

  return new EmbedBuilder()
    .setColor('#0c0c0d')
    .setTitle(type === 'robux'
      ? '<:emoji_25:1467261402527043777> LIVE STOCK ROBUX'
      : '<:emoji_33:1467339313669869648> LIVE STOCK REDFINGER')
    .setDescription(
      `<a:5044clockrunning:1472549710580547687> **Update**: <t:${now}:R>\n\n` +
      formatProducts(products, type !== 'robux') +
      `\n\n [**🎟️ MAU ORDER?** - Klik untuk order](${orderUrl})`
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERVAL MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

function startGlobalTimer() {
  if (globalTimer) return;
  globalTimer = setInterval(_tickAll, UPDATE_INTERVAL_MS);
  globalTimer.unref?.(); // jangan halangi proses Node exit
}

async function _tickAll() {
  if (liveMessages.size === 0) return;

  const live    = readLive();
  const expired = [];

  for (const [id, msg] of liveMessages) {
    const info = live[id];
    if (!info) { expired.push(id); continue; }
    try {
      await msg.edit({ embeds: [buildEmbed(info.type, info.guildId)] });
    } catch (err) {
      console.error(`[LiveStock] Gagal edit ${id}:`, err.message);
      expired.push(id);
    }
  }

  if (expired.length > 0) {
    for (const id of expired) {
      liveMessages.delete(id);
      delete live[id];
    }
    writeLive(live);
  }
}

function registerMessage(message, type) {
  liveMessages.set(message.id, message);
  startGlobalTimer();
}

// ─────────────────────────────────────────────────────────────────────────────
// TRIGGER IMMEDIATE UPDATE (dipanggil dari editstock / editredfinger)
// ─────────────────────────────────────────────────────────────────────────────

async function triggerUpdate(client, type) {
  const live = readLive();

  // Kumpulkan semua fetch secara paralel agar tidak blocking
  const tasks = Object.entries(live)
    .filter(([, info]) => !type || info.type === type)
    .map(async ([messageId, info]) => {
      try {
        const channel = await client.channels.fetch(info.channelId).catch(() => null);
        if (!channel) return;
        const msg = await channel.messages.fetch(messageId).catch(() => null);
        if (!msg) { delete live[messageId]; return; }
        await msg.edit({ embeds: [buildEmbed(info.type, info.guildId)] });
        // Pastikan terdaftar di liveMessages supaya interval berikutnya jalan
        liveMessages.set(messageId, msg);
      } catch (err) {
        console.error(`[LiveStock] triggerUpdate error ${messageId}:`, err.message);
      }
    });

  await Promise.allSettled(tasks);
  writeLive(live);
}

// ─────────────────────────────────────────────────────────────────────────────
// RESTORE SAAT BOT RESTART — fetch semua message secara paralel
// ─────────────────────────────────────────────────────────────────────────────

async function restoreIntervals(client) {
  const live    = readLive();
  const entries = Object.entries(live);
  if (entries.length === 0) return;

  console.log(`[LiveStock] Memulihkan ${entries.length} live message...`);

  const tasks = entries.map(async ([messageId, info]) => {
    try {
      const channel = await client.channels.fetch(info.channelId).catch(() => null);
      if (!channel) { delete live[messageId]; return; }
      const msg = await channel.messages.fetch(messageId).catch(() => null);
      if (!msg) { delete live[messageId]; return; }
      liveMessages.set(messageId, msg);
      console.log(`[LiveStock] ✅ Restored: ${messageId} (${info.type})`);
    } catch (err) {
      console.error(`[LiveStock] Gagal restore ${messageId}:`, err.message);
      delete live[messageId];
    }
  });

  await Promise.allSettled(tasks);
  writeLive(live);

  if (liveMessages.size > 0) startGlobalTimer();
}

// ─────────────────────────────────────────────────────────────────────────────
// SLASH COMMAND
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  triggerUpdate,
  restoreIntervals,

  data: new SlashCommandBuilder()
    .setName('stock')
    .setDescription('📊 Tampilkan Live Stock dengan auto-update')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub => sub.setName('robux').setDescription('📊 Live Stock Robux'))
    .addSubcommand(sub => sub.setName('redfinger').setDescription('📊 Live Stock Redfinger')),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });

    const type    = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    const message = await interaction.channel.send({ embeds: [buildEmbed(type, guildId)] });

    const live = readLive();
    live[message.id] = { type, channelId: interaction.channelId, guildId, createdAt: new Date().toISOString() };
    writeLive(live);

    registerMessage(message, type);
    await interaction.editReply({ content: '✅ Live stock aktif!' });
  },
};
