'use strict';

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('testimoni')
    .setDescription('Buat testimoni transaksi (Admin only)')
    .addUserOption(o => o.setName('buyer').setDescription('Tag customer/pembeli').setRequired(true))
    .addStringOption(o => o.setName('product').setDescription('Nama produk yang dibeli').setRequired(true))
    .addStringOption(o => o.setName('payment').setDescription('Metode pembayaran').setRequired(true))
    .addUserOption(o => o.setName('seller').setDescription('Tag seller/penjual').setRequired(true))
    .addAttachmentOption(o => o.setName('image').setDescription('Bukti transaksi (Opsional)'))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const buyer   = interaction.options.getUser('buyer');
    const seller  = interaction.options.getUser('seller') ?? interaction.user;
    const product = interaction.options.getString('product');
    const payment = interaction.options.getString('payment');
    const image   = interaction.options.getAttachment('image');

    const embed = new EmbedBuilder()
      .setColor('#0016ff')
      .setTitle(`Testimoni ${interaction.guild.name}`)
      .addFields(
        { name: '👤 Buyer',   value: `${buyer} (${buyer.username})`,   inline: false },
        { name: '👑 Seller',  value: `${seller} (${seller.username})`, inline: false },
        { name: '🛒 Product', value: product,                          inline: false },
        { name: '💳 Payment', value: payment,                          inline: false },
      )
      .setTimestamp();

    if (image) embed.setImage(image.url);

    const channelId = process.env.TESTIMONI_CHANNEL_ID;
    if (!channelId) {
      return interaction.reply({
        content: '⚠️ `TESTIMONI_CHANNEL_ID` tidak diset di `.env`. Berikut previewnya:',
        embeds: [embed], ephemeral: true,
      });
    }

    try {
      const ch = await interaction.client.channels.fetch(channelId);
      await ch.send({ embeds: [embed] });
      await interaction.reply({ content: `✅ Testimoni berhasil dikirim ke ${ch}!`, ephemeral: true });
    } catch (err) {
      console.error('Testimoni error:', err);
      await interaction.reply({
        content: '⚠️ Gagal kirim ke channel testimoni. Berikut previewnya:',
        embeds: [embed], ephemeral: true,
      });
    }
  },
};
