'use strict';

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db           = require('../database.js');
const { triggerUpdate } = require('./stock.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('editstock')
    .setDescription('🔧 Kelola produk Robux (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub => sub
      .setName('add').setDescription('Tambah produk Robux baru')
      .addStringOption(o => o.setName('id').setDescription('ID Produk').setRequired(true))
      .addStringOption(o => o.setName('name').setDescription('Nama produk').setRequired(true))
      .addIntegerOption(o => o.setName('stock').setDescription('Jumlah stock').setRequired(true).setMinValue(0))
      .addIntegerOption(o => o.setName('sold').setDescription('Jumlah terjual (default: 0)').setMinValue(0)))
    .addSubcommand(sub => sub
      .setName('updatestock').setDescription('Update stock produk')
      .addStringOption(o => o.setName('id').setDescription('ID produk').setRequired(true))
      .addIntegerOption(o => o.setName('stock').setDescription('Stock baru').setRequired(true).setMinValue(0)))
    .addSubcommand(sub => sub
      .setName('updatesold').setDescription('Update jumlah terjual')
      .addStringOption(o => o.setName('id').setDescription('ID produk').setRequired(true))
      .addIntegerOption(o => o.setName('sold').setDescription('Jumlah terjual baru').setRequired(true).setMinValue(0)))
    .addSubcommand(sub => sub
      .setName('list').setDescription('Lihat semua produk Robux'))
    .addSubcommand(sub => sub
      .setName('delete').setDescription('Hapus produk')
      .addStringOption(o => o.setName('id').setDescription('ID produk').setRequired(true))),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const sub = interaction.options.getSubcommand();

    if (sub === 'add') {
      const id    = interaction.options.getString('id');
      const name  = interaction.options.getString('name');
      const stock = interaction.options.getInteger('stock');
      const sold  = interaction.options.getInteger('sold') ?? 0;

      if (db.getProductById(id))
        return interaction.editReply({ content: `❌ Produk ID **${id}** sudah ada.` });

      const p = db.addProduct(id, name, stock, 0, sold);
      await interaction.editReply({ embeds: [_embed('✅ Produk Ditambahkan', '#00ff00', [
        { name: '🆔 ID',     value: String(p.id),  inline: true },
        { name: '📦 Nama',   value: name,           inline: true },
        { name: '📊 Stock',  value: String(stock),  inline: true },
        { name: '📈 Sold',   value: String(sold),   inline: true },
      ])] });
      await triggerUpdate(interaction.client, 'robux');
    }

    else if (sub === 'updatestock') {
      const id    = interaction.options.getString('id');
      const stock = interaction.options.getInteger('stock');
      const p     = db.getProductById(id);
      if (!p) return interaction.editReply({ content: `❌ Produk ID **${id}** tidak ditemukan.` });

      db.updateProductStock(id, stock);
      await interaction.editReply({ embeds: [_embed('✅ Stock Diupdate', '#ffa500', [
        { name: '🆔 ID',          value: String(id),   inline: true },
        { name: '📦 Nama',         value: p.name,       inline: true },
        { name: '📊 Stock Baru',   value: String(stock), inline: true },
      ])] });
      await triggerUpdate(interaction.client, 'robux');
    }

    else if (sub === 'updatesold') {
      const id   = interaction.options.getString('id');
      const sold = interaction.options.getInteger('sold');
      const p    = db.getProductById(id);
      if (!p) return interaction.editReply({ content: `❌ Produk ID **${id}** tidak ditemukan.` });

      db.updateProductSold(id, sold);
      await interaction.editReply({ embeds: [_embed('✅ Sold Diupdate', '#ffa500', [
        { name: '🆔 ID',        value: String(id),  inline: true },
        { name: '📦 Nama',       value: p.name,      inline: true },
        { name: '📈 Sold Baru',  value: String(sold), inline: true },
      ])] });
      await triggerUpdate(interaction.client, 'robux');
    }

    else if (sub === 'list') {
      const products = db.getAllRobuxProducts();
      if (products.length === 0)
        return interaction.editReply({ content: '❌ Belum ada produk.' });

      const desc = products.map(p =>
        `**ID ${p.id}**: ${p.name}\n└ Stock: ${p.stock} | Sold: ${p.sold}`
      ).join('\n\n');

      await interaction.editReply({ embeds: [_embed('📦 Daftar Produk Robux', '#5865f2', [], desc)] });
    }

    else if (sub === 'delete') {
      const id = interaction.options.getString('id');
      if (!db.deleteProduct(id))
        return interaction.editReply({ content: `❌ Produk ID **${id}** tidak ditemukan.` });

      await interaction.editReply({ embeds: [_embed('✅ Produk Dihapus', '#ff0000', [
        { name: '🆔 ID', value: String(id), inline: true },
      ])] });
      await triggerUpdate(interaction.client, 'robux');
    }
  },
};

function _embed(title, color, fields, description) {
  const e = new EmbedBuilder().setColor(color).setTitle(title).setTimestamp();
  if (description) e.setDescription(description);
  if (fields.length) e.addFields(fields);
  return e;
}
