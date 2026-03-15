'use strict';

const {
  SlashCommandBuilder, EmbedBuilder, ActionRowBuilder,
  ButtonBuilder, ButtonStyle, PermissionFlagsBits,
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('format')
    .setDescription('Kirim formulir data pesanan ke user (Login / Gamepass)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(o => o
      .setName('tipe').setDescription('Pilih tipe format').setRequired(true)
      .addChoices(
        { name: '🔐 ROBUX VILOG',  value: 'login'    },
        { name: '🎁 GIFT IN GAME', value: 'gamepass' },
      )),

  async execute(interaction) {
    const tipe = interaction.options.getString('tipe');
    const icon = interaction.client.user.displayAvatarURL();

    if (tipe === 'login') {
      const embed = new EmbedBuilder()
        .setColor('#0016ff')
        .setTitle('🔐 Data Akun Diperlukan')
        .setDescription('Isi form berikut untuk memproses pesanan Anda. Data Anda aman bersama kami.')
        .addFields(
          { name: '📋 Format Pengisian', value: 'Email/Username:\nPassword:\nBackup Code:', inline: false },
          { name: '⚠️ Penting: Backup Code', value: 'Jika belum punya backup code, pasang dulu.\n\n📺 **Tutorial:** [Klik Disini](https://youtube.com/shorts/IDmMaVVoPNE?si=nmh_EFQpoI_ONb1D)', inline: false },
        )
        .setFooter({ text: 'Klik tombol di bawah untuk mengisi data', iconURL: icon });

      const btn = new ButtonBuilder()
        .setCustomId('btn_format_input_login')
        .setLabel('📝 Isi Data Akun')
        .setStyle(ButtonStyle.Primary);

      return interaction.reply({ embeds: [embed], components: [new ActionRowBuilder().addComponents(btn)] });
    }

    if (tipe === 'gamepass') {
      const embed = new EmbedBuilder()
        .setColor('#0016ff')
        .setTitle('🎁 Data Gift In Game')
        .setDescription('Isi form berikut untuk memproses pesanan Anda. Data Anda aman bersama kami.')
        .addFields(
          { name: '📋 Format Pengisian', value: 'Username:\nGift In Game:\nMap/Ps:', inline: false },
          { name: '⚠️ Penting: Map/Ps', value: 'Jika belum punya link Map/Ps, pasang dulu sebelum melanjutkan.', inline: false },
        )
        .setFooter({ text: 'Klik tombol di bawah untuk mengisi format', iconURL: icon });

      const btn = new ButtonBuilder()
        .setCustomId('btn_format_input_gamepass')
        .setLabel('📝 Isi Format Gift')
        .setStyle(ButtonStyle.Success);

      return interaction.reply({ embeds: [embed], components: [new ActionRowBuilder().addComponents(btn)] });
    }
  },
};
