'use strict';

const {
  SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
} = require('discord.js');
const fs   = require('fs');
const path = require('path');

const STORE_CHANNEL_ID  = '1467359650507919501';
const TICKET_CHANNEL_ID = '1460489825911050355';
const STATUS_FILE       = path.join(__dirname, '../store_status.json');

// ─────────────────────────────────────────────────────────────────────────────
// STATUS HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function readStatus() {
  try {
    if (!fs.existsSync(STATUS_FILE)) return _defaultStatus();
    return JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8'));
  } catch { return _defaultStatus(); }
}

function writeStatus(data) {
  fs.writeFileSync(STATUS_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function _defaultStatus() {
  return { isOpen: false, openedBy: null, openedById: null, openedAt: null,
           closedBy: null, closedById: null, closedAt: null };
}

// ─────────────────────────────────────────────────────────────────────────────
// PANEL EMBED
// ─────────────────────────────────────────────────────────────────────────────

function buildPanel(status, user, note = null) {
  const isOpen = status.isOpen;
  const stateBlock = isOpen
    ? `> 🟢 **Status  :** BUKA\n> 👤 **Oleh     :** ${status.openedBy}`
    : status.closedAt
      ? `> 🔴 **Status  :** TUTUP\n> 👤 **Oleh     :** ${status.closedBy}`
      : '> 🔴 **Status  :** TUTUP\n> Belum ada riwayat pembukaan.';

  const embed = new EmbedBuilder()
    .setColor(isOpen ? '#00e676' : '#ff1744')
    .setAuthor({ name: 'Store Control Panel', iconURL: user.displayAvatarURL() })
    .setTitle(isOpen ? '🏪 Store Sedang BUKA' : '🏪 Store Sedang TUTUP')
    .setDescription(
      `${stateBlock}\n\n` +
      `**⏰ Jadwal Operasional**\n` +
      `> 📅 Hari kerja : \`10.00 – 01.00 WIB\`\n` +
      `> 🎉 Hari libur : \`07.00 – 03.00 WIB\`\n\n` +
      `📢 **Notifikasi ke:** <#${STORE_CHANNEL_ID}>`
    )
    .setFooter({ text: `Dijalankan oleh ${user.tag}`, iconURL: user.displayAvatarURL() })
    .setTimestamp();

  if (note) embed.addFields({ name: '\u200b', value: `> ${note}` });
  return embed;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMMAND
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  data: new SlashCommandBuilder()
    .setName('store')
    .setDescription('🏪 Buka atau tutup store')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const status  = readStatus();
    const btnOpen = new ButtonBuilder()
      .setCustomId('store_open').setLabel('Buka Store').setEmoji('🟢')
      .setStyle(ButtonStyle.Success).setDisabled(status.isOpen);
    const btnClose = new ButtonBuilder()
      .setCustomId('store_close').setLabel('Tutup Store').setEmoji('🔴')
      .setStyle(ButtonStyle.Danger).setDisabled(!status.isOpen);

    await interaction.reply({
      embeds: [buildPanel(status, interaction.user)],
      components: [new ActionRowBuilder().addComponents(btnOpen, btnClose)],
      ephemeral: true,
    });

    const collector = interaction.channel.createMessageComponentCollector({
      filter: i => i.user.id === interaction.user.id &&
        (i.customId === 'store_open' || i.customId === 'store_close'),
      time: 2 * 60_000,
    });

    collector.on('collect', async i => {
      const now       = new Date().toISOString();
      const prev      = readStatus();
      const targetCh  = interaction.guild.channels.cache.get(STORE_CHANNEL_ID);
      const orderBtn  = new ButtonBuilder()
        .setLabel('Order Sekarang').setEmoji('🛒').setStyle(ButtonStyle.Link)
        .setURL(`https://discord.com/channels/${interaction.guild.id}/${TICKET_CHANNEL_ID}`);

      if (i.customId === 'store_open') {
        const newStatus = { isOpen: true,
          openedBy: i.user.displayName || i.user.username, openedById: i.user.id, openedAt: now,
          closedBy: prev.closedBy, closedById: prev.closedById, closedAt: prev.closedAt,
        };
        writeStatus(newStatus);

        await targetCh?.send({
          content: '🔔 Special tag to @everyone',
          embeds: [new EmbedBuilder()
            .setColor('#00e676')
            .setTitle('<a:emoji_49:1472554810539642971> STORE OPEN')
            .setDescription(
              `Halo semuanya! Store kita lagi **Buka** nih~ Yuk langsung order sekarang! <:Order:1472540238579761363>\n\n` +
              `**👤 Dibuka oleh**\n<@${i.user.id}>\n\n` +
              `**⏰ Jadwal Operasional:**\n> - Hari kerja: 10.00 - 01.00 WIB\n> - Hari libur: 07.00 - 03.00 WIB`
            )
            .setThumbnail(i.user.displayAvatarURL({ dynamic: true, size: 256 }))
            .setFooter({ text: '🏪 Terima kasih sudah setia bersama kami ❤️' })
            .setTimestamp()],
          components: [new ActionRowBuilder().addComponents(orderBtn)],
        });

        await i.update({
          embeds: [buildPanel(newStatus, i.user, '✅ Notifikasi store buka telah dikirim!')],
          components: [new ActionRowBuilder().addComponents(
            ButtonBuilder.from(btnOpen).setDisabled(true),
            ButtonBuilder.from(btnClose).setDisabled(false),
          )],
        });

      } else {
        const newStatus = { isOpen: false,
          openedBy: prev.openedBy, openedById: prev.openedById, openedAt: prev.openedAt,
          closedBy: i.user.displayName || i.user.username, closedById: i.user.id, closedAt: now,
        };
        writeStatus(newStatus);

        await targetCh?.send({
          content: '🔔 Special tag to @everyone',
          embeds: [new EmbedBuilder()
            .setColor('#ff1744')
            .setTitle('<a:emoji_27:1467263227464253704> STORE CLOSED')
            .setDescription(
              `Maaf ya, store kita lagi **Tutup** dulu~ Ditunggu kabar buka berikutnya ya! 🙏\n\n` +
              `**👤 Ditutup oleh**\n<@${i.user.id}>\n\n` +
              `**⏰ Jadwal Operasional:**\n> - Hari kerja: 10.00 - 01.00 WIB\n> - Hari libur: 07.00 - 03.00 WIB`
            )
            .setThumbnail(i.user.displayAvatarURL({ dynamic: true, size: 256 }))
            .setFooter({ text: '🏪 Terima kasih sudah order hari ini ❤️' })
            .setTimestamp()],
        });

        await i.update({
          embeds: [buildPanel(newStatus, i.user, '✅ Notifikasi store tutup telah dikirim!')],
          components: [new ActionRowBuilder().addComponents(
            ButtonBuilder.from(btnOpen).setDisabled(false),
            ButtonBuilder.from(btnClose).setDisabled(true),
          )],
        });
      }

      collector.stop('done');
    });

    collector.on('end', async (_, reason) => {
      if (reason === 'time') {
        await interaction.editReply({ content: '⏰ Panel expired. Ketik `/store` lagi.', embeds: [], components: [] })
          .catch(() => {});
      }
    });
  },
};
