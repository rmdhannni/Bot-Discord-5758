'use strict';

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

const PAYMENT_DATA = {
  azhar: {
    title: '💳 Metode Pembayaran QRIS — Azhar',
    image: 'https://cdn.discordapp.com/attachments/1465637650152034304/1475856676816031837/Cream_and_Green_Modern_Simple_Scan_Here_to_Payment_QR_Code_A4_Document_20260214_213849_0000.png?ex=699f0223&is=699db0a3&hm=0d504017c32bfe2903e0b4e6950de5939e133de1cbebb81d6bdec509f2cb98c3&',
    color: '#0016ff',
  },
  dani: {
    title: '💳 Metode Pembayaran QRIS — Yusuf Rahmadhani A',
    image: 'https://media.discordapp.net/attachments/1460416360554172416/1480606529349746750/Cream_and_Green_Modern_Simple_Scan_Here_to_Payment_QR_Code_A4_Document_20260309_234106_0000.png?ex=69b049c8&is=69aef848&hm=27326cf70919527f041b7faa5d46794f45634a932df445b988e1b7fd10486783&=&format=webp&quality=lossless&width=1055&height=1491',
    color: '#2ecc71',
  },
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('payment')
    .setDescription('Tampilkan metode pembayaran via QRIS')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(o => o
      .setName('tujuan').setDescription('Pilih tujuan pembayaran').setRequired(true)
      .addChoices(
        { name: 'Azhar', value: 'azhar' },
        { name: 'Dani',  value: 'dani'  },
      )),

  async execute(interaction) {
    const data = PAYMENT_DATA[interaction.options.getString('tujuan')];

    const embed = new EmbedBuilder()
      .setColor(data.color)
      .setTitle(data.title)
      .setDescription('Scan kode QRIS di bawah untuk menyelesaikan pembayaran.')
      .addFields({
        name: '⚠️ Konfirmasi',
        value: 'Setelah transfer berhasil, kirim bukti transfer (screenshot) agar pesanan segera diproses.',
      })
      .setImage(data.image)
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
