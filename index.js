'use strict';

require('dotenv').config();

const {
  Client, GatewayIntentBits, Collection,
  REST, Routes,
  ModalBuilder, TextInputBuilder, TextInputStyle,
  ActionRowBuilder, EmbedBuilder, MessageFlags,
} = require('discord.js');
const fs   = require('fs');
const path = require('path');

// ─────────────────────────────────────────────────────────────────────────────
// 1. CLIENT
// ─────────────────────────────────────────────────────────────────────────────

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
  ],
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. LOAD COMMANDS
// ─────────────────────────────────────────────────────────────────────────────

client.commands = new Collection();
const cmdDir    = path.join(__dirname, 'commands');

for (const file of fs.readdirSync(cmdDir).filter(f => f.endsWith('.js'))) {
  const cmd = require(path.join(cmdDir, file));
  if ('data' in cmd && 'execute' in cmd) {
    client.commands.set(cmd.data.name, cmd);
    console.log(`✅ Loaded: ${cmd.data.name}`);
  } else {
    console.warn(`⚠️  Skipped ${file} (missing data/execute)`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. REGISTER SLASH COMMANDS — hanya jika commands berubah
// ─────────────────────────────────────────────────────────────────────────────

const HASH_FILE = path.join(__dirname, '.cmd_hash');

function _cmdHash(cmds) {
  return require('crypto')
    .createHash('md5')
    .update(JSON.stringify(cmds))
    .digest('hex');
}

async function registerCommands() {
  const cmds    = client.commands.map(c => c.data.toJSON());
  const newHash = _cmdHash(cmds);

  let prevHash = '';
  try { prevHash = fs.readFileSync(HASH_FILE, 'utf8').trim(); } catch { /* file tidak ada */ }

  if (newHash === prevHash) {
    console.log('✅ Commands tidak berubah, skip registrasi.');
    return;
  }

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try {
    console.log('🔄 Mendaftarkan slash commands...');
    if (process.env.GUILD_ID) {
      await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), { body: cmds });
    } else {
      await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: cmds });
    }
    fs.writeFileSync(HASH_FILE, newHash, 'utf8');
    console.log('✅ Commands berhasil didaftarkan!');
  } catch (err) {
    console.error('❌ Gagal mendaftarkan commands:', err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. READY
// ─────────────────────────────────────────────────────────────────────────────

client.once('clientReady', async () => {
  console.log(`✅ Bot online: ${client.user.tag}`);

  // Jalankan register + restore secara paralel agar startup lebih cepat
  await Promise.allSettled([
    registerCommands(),
    client.commands.get('stock')?.restoreIntervals?.(client),
  ]);

  console.log('✅ Startup selesai.');
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. INTERACTION HANDLER
// ─────────────────────────────────────────────────────────────────────────────

client.on('interactionCreate', async interaction => {
  try {

    // ── A. SLASH COMMANDS ────────────────────────────────────────────────────
    if (interaction.isChatInputCommand()) {
      const cmd = client.commands.get(interaction.commandName);
      if (!cmd) return interaction.reply({ content: '❌ Command tidak ditemukan.', flags: MessageFlags.Ephemeral });
      return cmd.execute(interaction);
    }

    // ── B. BUTTONS ───────────────────────────────────────────────────────────
    if (interaction.isButton()) {
      const { customId } = interaction;
      const order = client.commands.get('order');

      if (customId === 'create_ticket_order')              return order?.handleCreateTicket?.(interaction);
      if (customId === 'close_ticket_init' ||
          customId.startsWith('close_ticket_'))            return order?.handleCloseTicket?.(interaction);
      if (customId === 'ticket_confirm_delete')            return order?.handleTicketDelete?.(interaction);
      if (customId === 'ticket_cancel_delete')             return interaction.update({ content: '✅ Batal menghapus tiket.', embeds: [], components: [] });
      if (customId.startsWith('confirm_order_')) {
        const productId = parseInt(customId.split('_')[2]);
        return order?.handleOrderConfirm?.(interaction, productId);
      }
      if (customId === 'cancel_order_selection')           return order?.handleOrderCancel?.(interaction);

      // Form Login Akun
      if (customId === 'btn_format_input_login') {
        const modal = new ModalBuilder().setCustomId('modal_format_input').setTitle('🔐 Isi Data Akun');
        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('input_email').setLabel('Email / Username').setStyle(TextInputStyle.Short).setRequired(true),
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('input_pass').setLabel('Password').setStyle(TextInputStyle.Short).setRequired(true),
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('input_backup').setLabel('Backup Code (Min. 3)').setStyle(TextInputStyle.Short).setPlaceholder('Contoh: 12345, 67891, 01112').setRequired(true),
          ),
        );
        return interaction.showModal(modal);
      }

      // Form Gift In Game
      if (customId === 'btn_format_input_gamepass') {
        const modal = new ModalBuilder().setCustomId('modal_gamepass_input').setTitle('🎁 Isi Format Gift In Game');
        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('input_usn').setLabel('Username').setStyle(TextInputStyle.Short).setRequired(true),
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('input_gift').setLabel('Gift In Game').setStyle(TextInputStyle.Short).setPlaceholder('Barang/Item yang di-gift').setRequired(true),
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('input_ps').setLabel('Map/Ps').setStyle(TextInputStyle.Short).setPlaceholder('Link Map/Ps').setRequired(true),
          ),
        );
        return interaction.showModal(modal);
      }
    }

    // ── C. SELECT MENUS ──────────────────────────────────────────────────────
    if (interaction.isStringSelectMenu()) {
      if (interaction.customId === 'rate_select_menu') {
        const rating = interaction.values[0];
        const modal  = new ModalBuilder().setCustomId(`review_modal_${rating}`).setTitle(`⭐ Anda memilih ${rating} Bintang`);
        modal.addComponents(new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('review_input').setLabel('Tulis Ulasan Singkat').setStyle(TextInputStyle.Paragraph).setPlaceholder('Ceritakan pengalaman Anda...').setRequired(true),
        ));
        return interaction.showModal(modal);
      }

      if (interaction.customId === 'select_product') {
        return client.commands.get('order')?.handleProductSelect?.(interaction);
      }
    }

    // ── D. MODAL SUBMITS ─────────────────────────────────────────────────────
    if (interaction.isModalSubmit()) {

      // 1. Review / Testimoni
      if (interaction.customId.startsWith('review_modal_')) {
        const rating     = parseInt(interaction.customId.split('_')[2]);
        const reviewText = interaction.fields.getTextInputValue('review_input');
        const stars      = '⭐'.repeat(rating);

        await interaction.reply({ content: '✅ Terima kasih! Testimoni Anda telah terkirim.', flags: MessageFlags.Ephemeral });

        const channelId = process.env.REVIEW_CHANNEL_ID;
        if (!channelId) return;

        const ch = await interaction.client.channels.fetch(channelId).catch(() => null);
        if (!ch) return;

        await ch.send({
          embeds: [new EmbedBuilder()
            .setColor('#0016ff')
            .setTitle('🔅 Customer Rating')
            .setThumbnail(interaction.user.displayAvatarURL())
            .addFields(
              { name: 'Rating',   value: `${stars} (${rating}/5)`,           inline: false },
              { name: 'Customer', value: `${interaction.user}`,               inline: false },
              { name: 'Ulasan',   value: reviewText,                          inline: false },
            )
            .setTimestamp()],
        });
        return;
      }

      // 2. Data Login
      if (interaction.customId === 'modal_format_input') {
        const email  = interaction.fields.getTextInputValue('input_email');
        const pass   = interaction.fields.getTextInputValue('input_pass');
        const backup = interaction.fields.getTextInputValue('input_backup');

        return interaction.reply({
          embeds: [new EmbedBuilder()
            .setColor('#ff9900')
            .setTitle('🔐 Data Akun Diterima')
            .setDescription(`Data akun dari ${interaction.user}`)
            .addFields(
              { name: '📧 Email/Username', value: `\`${email}\``,    inline: true },
              { name: '🔑 Password',       value: `||${pass}||`,     inline: true },
              { name: '🛡️ Backup Code',    value: `\`${backup}\``,   inline: true },
            )
            .setFooter({ text: 'Data ini bersifat rahasia. Hapus jika sudah tidak diperlukan.' })
            .setTimestamp()],
        });
      }

      // 3. Data Gift In Game
      if (interaction.customId === 'modal_gamepass_input') {
        const usn  = interaction.fields.getTextInputValue('input_usn');
        const gift = interaction.fields.getTextInputValue('input_gift');
        const ps   = interaction.fields.getTextInputValue('input_ps');

        return interaction.reply({
          embeds: [new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('🎁 Data Gift In Game')
            .setDescription(`Data dari ${interaction.user}`)
            .addFields(
              { name: 'Username',     value: `\`${usn}\``,  inline: true },
              { name: 'Gift In Game', value: `\`${gift}\``, inline: true },
              { name: 'Map/Ps',       value: `\`${ps}\``,   inline: true },
            )
            .setFooter({ text: 'Data ini bersifat rahasia. Hapus jika sudah tidak diperlukan.' })
            .setTimestamp()],
        });
      }
    }

  } catch (err) {
    console.error('❌ Interaction error:', err);
    const msg = { content: '❌ Terjadi kesalahan.', flags: MessageFlags.Ephemeral };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(msg).catch(() => {});
    } else {
      await interaction.reply(msg).catch(() => {});
    }
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. ERROR HANDLING
// ─────────────────────────────────────────────────────────────────────────────

process.on('unhandledRejection', err => console.error('❌ Unhandled rejection:', err));

client.login(process.env.DISCORD_TOKEN).catch(err => {
  console.error('❌ Login gagal:', err);
  process.exit(1);
});
