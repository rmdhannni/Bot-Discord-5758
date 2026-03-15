'use strict';

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db                = require('../database.js');
const { triggerUpdate } = require('./stock.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('editredfinger')
    .setDescription('🔧 Kelola produk Redfinger (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub => sub
      .setName('add').setDescription('Tambah produk Redfinger baru')
      .addStringOption(o => o.setName('id').setDescription('ID Produk (cth: vip7d)').setRequired(true))
      .addStringOption(o => o.setName('name').setDescription('Nama produk').setRequired(true))
      .addIntegerOption(o => o.setName('stock').setDescription('Jumlah stock').setRequired(true).setMinValue(0))
      .addIntegerOption(o => o.setName('price').setDescription('Harga (Rp)').setRequired(true).setMinValue(0))
      .addIntegerOption(o => o.setName('sold').setDescription('Jumlah terjual (default: 0)').setMinValue(0)))
    .addSubcommand(sub => sub
      .setName('updatestock').setDescription('Update stock')
      .addStringOption(o => o.setName('id').setDescription('ID produk').setRequired(true))
      .addIntegerOption(o => o.setName('stock').setDescription('Stock baru').setRequired(true).setMinValue(0)))
    .addSubcommand(sub => sub
      .setName('updatesold').setDescription('Update jumlah terjual')
      .addStringOption(o => o.setName('id').setDescription('ID produk').setRequired(true))
      .addIntegerOption(o => o.setName('sold').setDescription('Jumlah terjual baru').setRequired(true).setMinValue(0)))
    .addSubcommand(sub => sub
      .setName('updateprice').setDescription('Update harga')
      .addStringOption(o => o.setName('id').setDescription('ID produk').setRequired(true))
      .addIntegerOption(o => o.setName('price').setDescription('Harga baru (Rp)').setRequired(true).setMinValue(0)))
    .addSubcommand(sub => sub
      .setName('list').setDescription('Lihat semua produk Redfinger'))
    .addSubcommand(sub => sub
      .setName('delete').setDescription('Hapus produk')
      .addStringOption(o => o.setName('id').setDescription('ID produk').setRequired(true))),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    const sub = interaction.options.getSubcommand();

    if (sub === 'add') {
      const id    = interaction.options.getString('id');
      const name  = interaction.options.getString('name');
      const stock = interaction.options.getInteger('stock');
      const price = interaction.options.getInteger('price');
      const sold  = interaction.options.getInteger('sold') ?? 0;

      if (db.getRedfingerById(id))
        return interaction.editReply({ content: `❌ Produk ID **${id}** sudah ada.` });

      const p = db.addRedfingerProduct(id, name, stock, price, sold);
      await interaction.editReply({ embeds: [_embed('✅ Produk Redfinger Ditambahkan', '#00ff00', [
        { name: '🆔 ID',     value: String(p.id),                         inline: true },
        { name: '📦 Nama',   value: name,                                  inline: true },
        { name: '📊 Stock',  value: stock.toLocaleString('id-ID'),         inline: true },
        { name: '💰 Price',  value: `Rp ${price.toLocaleString('id-ID')}`, inline: true },
        { name: '📈 Sold',   value: String(sold),                          inline: true },
      ])] });
      await triggerUpdate(interaction.client, 'redfinger');
    }

    else if (sub === 'updatestock') {
      const id    = interaction.options.getString('id');
      const stock = interaction.options.getInteger('stock');
      const p     = db.getRedfingerById(id);
      if (!p) return interaction.editReply({ content: `❌ Produk ID **${id}** tidak ditemukan.` });

      db.updateRedfingerStock(id, stock);
      await interaction.editReply({ embeds: [_embed('✅ Stock Redfinger Diupdate', '#ffa500', [
        { name: '🆔 ID',         value: String(id),                       inline: true },
        { name: '📦 Nama',        value: p.name,                           inline: true },
        { name: '📊 Stock Baru',  value: stock.toLocaleString('id-ID'),    inline: true },
      ])] });
      await triggerUpdate(interaction.client, 'redfinger');
    }

    else if (sub === 'updatesold') {
      const id   = interaction.options.getString('id');
      const sold = interaction.options.getInteger('sold');
      const p    = db.getRedfingerById(id);
      if (!p) return interaction.editReply({ content: `❌ Produk ID **${id}** tidak ditemukan.` });

      db.updateRedfingerSold(id, sold);
      await interaction.editReply({ embeds: [_embed('✅ Sold Redfinger Diupdate', '#ffa500', [
        { name: '🆔 ID',       value: String(id),  inline: true },
        { name: '📦 Nama',      value: p.name,      inline: true },
        { name: '📈 Sold Baru', value: String(sold), inline: true },
      ])] });
      await triggerUpdate(interaction.client, 'redfinger');
    }

    else if (sub === 'updateprice') {
      const id    = interaction.options.getString('id');
      const price = interaction.options.getInteger('price');
      const p     = db.getRedfingerById(id);
      if (!p) return interaction.editReply({ content: `❌ Produk ID **${id}** tidak ditemukan.` });

      db.updateRedfingerPrice(id, price);
      await interaction.editReply({ embeds: [_embed('✅ Price Redfinger Diupdate', '#ffa500', [
        { name: '🆔 ID',          value: String(id),                        inline: true },
        { name: '📦 Nama',         value: p.name,                            inline: true },
        { name: '💰 Price Baru',   value: `Rp ${price.toLocaleString('id-ID')}`, inline: true },
      ])] });
      await triggerUpdate(interaction.client, 'redfinger');
    }

    else if (sub === 'list') {
      const products = db.getAllRedfingerProducts();
      if (products.length === 0)
        return interaction.editReply({ content: '❌ Belum ada produk Redfinger.' });

      const desc = products.map(p =>
        `**ID** \`${p.id}\`: ${p.name}\n` +
        `└ Stock: **${p.stock.toLocaleString('id-ID')}** | Price: **Rp ${p.price.toLocaleString('id-ID')}** | Sold: **${p.sold}**`
      ).join('\n\n');

      await interaction.editReply({ embeds: [_embed('📦 Daftar Produk Redfinger', '#5865f2', [], desc)] });
    }

    else if (sub === 'delete') {
      const id = interaction.options.getString('id');
      if (!db.deleteRedfingerProduct(id))
        return interaction.editReply({ content: `❌ Produk ID **${id}** tidak ditemukan.` });

      await interaction.editReply({ embeds: [_embed('✅ Produk Redfinger Dihapus', '#ff0000', [
        { name: '🆔 ID', value: String(id), inline: true },
      ])] });
      await triggerUpdate(interaction.client, 'redfinger');
    }
  },
};

function _embed(title, color, fields, description) {
  const e = new EmbedBuilder().setColor(color).setTitle(title).setTimestamp();
  if (description) e.setDescription(description);
  if (fields.length) e.addFields(fields);
  return e;
}
