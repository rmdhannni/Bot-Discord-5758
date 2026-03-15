'use strict';

const {
  SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits,
  ActionRowBuilder, StringSelectMenuBuilder,
} = require('discord.js');
const db = require('../database.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('doneoder')
    .setDescription('Selesaikan pesanan & tagih testimoni (Admin only)')
    .addUserOption(o => o.setName('user').setDescription('Tag user untuk diminta testimoni (Opsional)'))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('user');

    // ── Mode 1: admin tag user secara manual ──────────────────────────────────
    if (targetUser) {
      const sent = await _sendReviewDM(targetUser);
      return interaction.reply({
        content: sent
          ? `Terima kasih sudah order! Kak ${targetUser}, cek DM ya ✨`
          : `❌ Gagal kirim DM ke ${targetUser}. Pastikan DM mereka terbuka.`,
        ephemeral: !sent,
      });
    }

    // ── Mode 2: detect order dari nama channel tiket ───────────────────────────
    const match = interaction.channel.name.match(/^order-(\d+)-/);
    if (!match)
      return interaction.reply({ content: '❌ Gunakan di channel tiket atau tag user: `/doneoder user:@nama`', ephemeral: true });

    const orderId = parseInt(match[1]);
    const order   = db.getOrderById(orderId);

    if (!order)
      return interaction.reply({ content: `❌ Pesanan #${orderId} tidak ditemukan.`, ephemeral: true });

    if (order.status === 'completed')
      return interaction.reply({ content: `❌ Pesanan #${orderId} sudah selesai.`, ephemeral: true });

    db.updateOrderStatus(orderId, 'completed');

    try {
      const buyer = await interaction.client.users.fetch(order.user_id);
      await _sendReviewDM(buyer, orderId);
    } catch { /* DM gagal, lanjut saja */ }

    await interaction.reply({
      content: `✅ Pesanan #${orderId} selesai. DM rating sudah dikirim ke pembeli.`,
    });
  },
};

async function _sendReviewDM(user, orderId = null) {
  try {
    const embed = new EmbedBuilder()
      .setColor('#0016ff')
      .setTitle('🎉 Transaksi Selesai!')
      .setDescription(`Halo ${user.username}, terima kasih telah bertransaksi!`)
      .addFields({ name: '⭐ Rating & Ulasan', value: 'Pilih bintang dari dropdown, lalu isi ulasan singkat.' })
      .setFooter({ text: 'Terima kasih sudah mempercayai kami!' })
      .setTimestamp();

    const select = new StringSelectMenuBuilder()
      .setCustomId('rate_select_menu')
      .setPlaceholder('Pilih bintang...')
      .addOptions(
        { label: '⭐ 1', value: '1', emoji: '⭐' },
        { label: '⭐⭐ 2', value: '2', emoji: '⭐' },
        { label: '⭐⭐⭐ 3', value: '3', emoji: '⭐' },
        { label: '⭐⭐⭐⭐ 4', value: '4', emoji: '⭐' },
        { label: '⭐⭐⭐⭐⭐ 5', value: '5', emoji: '⭐' },
      );

    await user.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(select)] });
    return true;
  } catch {
    return false;
  }
}
