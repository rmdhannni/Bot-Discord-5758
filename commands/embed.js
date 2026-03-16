'use strict';

const {
  SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ChannelType, MessageFlags,
} = require('discord.js');

// ─────────────────────────────────────────────────────────────────────────────
// HELPER — bangun EmbedBuilder dari opsi interaksi
// ─────────────────────────────────────────────────────────────────────────────

function buildEmbed(opts) {
  const embed = new EmbedBuilder();

  if (opts.color)       embed.setColor(opts.color);
  if (opts.title)       embed.setTitle(opts.title);
  if (opts.titleUrl)    embed.setURL(opts.titleUrl);
  if (opts.description) embed.setDescription(opts.description);
  if (opts.image)       embed.setImage(opts.image);
  if (opts.thumbnail)   embed.setThumbnail(opts.thumbnail);
  if (opts.timestamp)   embed.setTimestamp();

  if (opts.authorName) {
    embed.setAuthor({
      name:    opts.authorName,
      iconURL: opts.authorIcon || undefined,
    });
  }

  if (opts.footerText) {
    embed.setFooter({
      text:    opts.footerText,
      iconURL: opts.footerIcon || undefined,
    });
  }

  if (opts.fields && opts.fields.length > 0) {
    embed.addFields(opts.fields);
  }

  return embed;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER — bangun komponen tombol order
// ─────────────────────────────────────────────────────────────────────────────

function buildOrderButton(guildId, ticketChannelId, label) {
  const btn = new ButtonBuilder()
    .setLabel(label || '🛒 Order Sekarang')
    .setStyle(ButtonStyle.Link)
    .setURL(`https://discord.com/channels/${guildId}/${ticketChannelId}`);

  return new ActionRowBuilder().addComponents(btn);
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER — parse warna hex, return null jika tidak valid
// ─────────────────────────────────────────────────────────────────────────────

function parseColor(raw) {
  if (!raw) return null;
  const cleaned = raw.startsWith('#') ? raw : `#${raw}`;
  return /^#[0-9A-Fa-f]{6}$/.test(cleaned) ? cleaned : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// CHANNEL TIKET — ID default untuk tombol order
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_TICKET_CHANNEL_ID = '1460489825911050355';

// ─────────────────────────────────────────────────────────────────────────────
// COMMAND DEFINITION
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  data: new SlashCommandBuilder()
    .setName('embed')
    .setDescription('📢 Buat embed promosi produk (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)

    // ── KONTEN UTAMA ──────────────────────────────────────────────────────────
    .addStringOption(o => o
      .setName('judul')
      .setDescription('Judul embed — tampil besar di atas')
      .setRequired(true)
      .setMaxLength(256))

    .addStringOption(o => o
      .setName('deskripsi')
      .setDescription('Isi teks promosi — mendukung **bold**, *italic*, [link](url)')
      .setRequired(true)
      .setMaxLength(4000))

    .addStringOption(o => o
      .setName('warna')
      .setDescription('Warna garis kiri — format hex, contoh: #0016ff')
      .setRequired(false))

    .addStringOption(o => o
      .setName('judul_url')
      .setDescription('URL — jadikan judul sebagai link yang bisa diklik')
      .setRequired(false))

    // ── GAMBAR & MEDIA ────────────────────────────────────────────────────────
    .addStringOption(o => o
      .setName('gambar')
      .setDescription('URL gambar utama — tampil lebar penuh di bawah embed')
      .setRequired(false))

    .addAttachmentOption(o => o
      .setName('upload_gambar')
      .setDescription('Upload file gambar langsung dari perangkat kamu')
      .setRequired(false))

    .addStringOption(o => o
      .setName('thumbnail')
      .setDescription('URL thumbnail — gambar kecil di pojok kanan atas')
      .setRequired(false))

    // ── IDENTITAS & BRANDING ──────────────────────────────────────────────────
    .addStringOption(o => o
      .setName('author_nama')
      .setDescription('Nama author — tampil di paling atas embed')
      .setRequired(false)
      .setMaxLength(256))

    .addStringOption(o => o
      .setName('author_icon')
      .setDescription('URL ikon author — gambar bulat kecil di samping nama author')
      .setRequired(false))

    .addStringOption(o => o
      .setName('footer')
      .setDescription('Teks footer — tampil kecil di paling bawah')
      .setRequired(false)
      .setMaxLength(2048))

    .addStringOption(o => o
      .setName('footer_icon')
      .setDescription('URL ikon footer — gambar bulat kecil di samping teks footer')
      .setRequired(false))

    .addBooleanOption(o => o
      .setName('timestamp')
      .setDescription('Tampilkan waktu kirim otomatis di sebelah footer? (default: ya)')
      .setRequired(false))

    // ── PENGIRIMAN & TARGET ───────────────────────────────────────────────────
    .addChannelOption(o => o
      .setName('channel')
      .setDescription('Channel tujuan kirim — default: channel ini')
      .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
      .setRequired(false))

    .addStringOption(o => o
      .setName('mention')
      .setDescription('Mention sebelum embed — contoh: @everyone atau @RoleName')
      .setRequired(false)
      .setMaxLength(100))

    .addBooleanOption(o => o
      .setName('tombol_order')
      .setDescription('Tambahkan tombol Order Sekarang? (default: ya)')
      .setRequired(false))

    .addStringOption(o => o
      .setName('label_tombol')
      .setDescription('Teks label tombol order — default: 🛒 Order Sekarang')
      .setRequired(false)
      .setMaxLength(80)),

  // ─────────────────────────────────────────────────────────────────────────
  // EXECUTE
  // ─────────────────────────────────────────────────────────────────────────

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    // ── Ambil semua opsi ───────────────────────────────────────────────────
    const judul        = interaction.options.getString('judul');
    const deskripsi    = interaction.options.getString('deskripsi');
    const warnaMentah  = interaction.options.getString('warna');
    const judulUrl     = interaction.options.getString('judul_url');
    const gambarUrl    = interaction.options.getString('gambar');
    const uploadGambar = interaction.options.getAttachment('upload_gambar');
    const thumbnail    = interaction.options.getString('thumbnail');
    const authorNama   = interaction.options.getString('author_nama');
    const authorIcon   = interaction.options.getString('author_icon');
    const footerTeks   = interaction.options.getString('footer');
    const footerIcon   = interaction.options.getString('footer_icon');
    const showTimestamp = interaction.options.getBoolean('timestamp') ?? true;
    const targetChannel = interaction.options.getChannel('channel') ?? interaction.channel;
    const mentionTeks  = interaction.options.getString('mention');
    const pakaiTombol  = interaction.options.getBoolean('tombol_order') ?? true;
    const labelTombol  = interaction.options.getString('label_tombol');

    // ── Validasi warna ─────────────────────────────────────────────────────
    const warna = parseColor(warnaMentah);
    if (warnaMentah && !warna) {
      return interaction.editReply({
        content: `❌ Warna **${warnaMentah}** tidak valid. Gunakan format hex, contoh: \`#0016ff\` atau \`0016ff\`.`,
      });
    }

    // ── Tentukan sumber gambar utama (URL atau attachment) ─────────────────
    const finalGambar = uploadGambar?.url ?? gambarUrl ?? null;

    // ── Bangun embed ───────────────────────────────────────────────────────
    const embed = buildEmbed({
      color:       warna       || '#0016ff',
      title:       judul,
      titleUrl:    judulUrl    || null,
      description: deskripsi,
      image:       finalGambar,
      thumbnail:   thumbnail   || null,
      authorName:  authorNama  || null,
      authorIcon:  authorIcon  || null,
      footerText:  footerTeks  || null,
      footerIcon:  footerIcon  || null,
      timestamp:   showTimestamp,
      fields:      [],
    });

    // ── Bangun payload ─────────────────────────────────────────────────────
    const payload = {
      content:    mentionTeks || null,
      embeds:     [embed],
      components: [],
    };

    if (pakaiTombol) {
      payload.components = [
        buildOrderButton(interaction.guildId, DEFAULT_TICKET_CHANNEL_ID, labelTombol),
      ];
    }

    // ── Kirim ke channel tujuan ────────────────────────────────────────────
    try {
      const sent = await targetChannel.send(payload);

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor('#00ff88')
            .setTitle('✅ Embed Berhasil Dikirim!')
            .addFields(
              { name: '📢 Channel',  value: `${targetChannel}`,                                          inline: true  },
              { name: '🆔 Message',  value: `[Klik untuk lihat](${sent.url})`,                           inline: true  },
              { name: '🎨 Warna',    value: warna || '#0016ff',                                          inline: true  },
              { name: '🖼️ Gambar',   value: finalGambar    ? '✅ Ada' : '—',                             inline: true  },
              { name: '🖼️ Thumbnail',value: thumbnail      ? '✅ Ada' : '—',                             inline: true  },
              { name: '🛒 Tombol',   value: pakaiTombol    ? '✅ Ada' : '—',                             inline: true  },
              { name: '👤 Author',   value: authorNama     ? `\`${authorNama}\`` : '—',                  inline: true  },
              { name: '📝 Footer',   value: footerTeks     ? `\`${footerTeks.slice(0, 40)}...\`` : '—', inline: true  },
              { name: '🔔 Mention',  value: mentionTeks    ? `\`${mentionTeks}\`` : '—',                 inline: true  },
            )
            .setTimestamp(),
        ],
      });

    } catch (err) {
      console.error('❌ Gagal kirim embed:', err);

      // Tangani error permission
      if (err.code === 50013) {
        return interaction.editReply({
          content: `❌ Bot tidak punya izin mengirim pesan di ${targetChannel}. Pastikan bot punya permission **Send Messages** dan **Embed Links** di channel tersebut.`,
        });
      }

      return interaction.editReply({
        content: `❌ Gagal mengirim embed: ${err.message}`,
      });
    }
  },
};