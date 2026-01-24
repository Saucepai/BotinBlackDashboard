const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  MessageFlags
} = require('discord.js');

const {
  getUserById,
  updateUser,
  getNazarItemList
} = require('../utils/dbUtils');

/* ===========================
   Safety helpers
=========================== */

const safeString = (v) => (typeof v === 'string' ? v : '');
const safeNumber = (v) => Number.isFinite(Number(v)) ? Number(v) : 0;
const safeArray = (v) => Array.isArray(v) ? v : [];

/* ===========================
   Command
=========================== */

module.exports = {
  data: new SlashCommandBuilder()
    .setName('nazar-store')
    .setDescription('🧿 Browse Madam Nazar’s traveling curiosities.'),

  async execute(interaction) {
    await interaction.deferReply();

    /* ===========================
       Load store items
    =========================== */

    const items = safeArray(await getNazarItemList()).filter(i => i && i.Name);
    if (!items.length) {
      return interaction.editReply({
        content: '📁 Madam Nazar’s wares are hidden from sight today.',
        flags: MessageFlags.Ephemeral
      });
    }

    const userId = interaction.user.id;
    let user = await getUserById(userId);

    if (!user) {
      return interaction.editReply({
        content: '⚠️ No traveler record found.',
        flags: MessageFlags.Ephemeral
      });
    }

    const ITEMS_PER_PAGE = 4;
    let page = 0;

    /* ===========================
       Embed builder
    =========================== */

    const buildEmbed = () => {
      const start = page * ITEMS_PER_PAGE;
      const pageItems = items.slice(start, start + ITEMS_PER_PAGE);

      const embed = new EmbedBuilder()
        .setColor(0x4B0082)
        .setTitle('🧿 Madam Nazar’s Traveling Curiosities')
        .setDescription('Exotic treasures from across the frontier.')
        .setThumbnail('https://i.pinimg.com/736x/a0/a4/66/a0a466656d620756c73cdb88a5b0fa97.jpg')
        .setFooter({ text: `Page ${page + 1} of ${Math.ceil(items.length / ITEMS_PER_PAGE)}` })
        .setTimestamp();

      pageItems.forEach(item => {
        embed.addFields({
          name: `🔮 ${safeString(item.Name)}`,
          value:
            `💵 **$${safeNumber(item.Price)}**\n` +
            `📜 ${safeString(item.Type || 'Collectible')}\n` +
            `✨ ${safeString(item.Details || 'A rare mystery.')}`
        });
      });

      return embed;
    };

    /* ===========================
       Button builder
    =========================== */

    const buildButtons = (userRow) => {
      const owned = safeString(userRow?.Treasure)
        .split(',')
        .map(v => v.trim())
        .filter(Boolean);

      const start = page * ITEMS_PER_PAGE;
      const pageItems = items.slice(start, start + ITEMS_PER_PAGE);

      const rows = [];

      pageItems.forEach(item => {
        const name = safeString(item.Name);
        const key = name.replace(/\s+/g, '_');

        const hasItem = owned.includes(name);

        rows.push(
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`buy_${key}`)
              .setLabel(`Acquire ${name}`)
              .setStyle(ButtonStyle.Success),

            new ButtonBuilder()
              .setCustomId(`sell_${key}`)
              .setLabel(`Trade ${name}`)
              .setStyle(ButtonStyle.Danger)
              .setDisabled(!hasItem)
          )
        );
      });

      rows.push(
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('prev')
            .setLabel('⏪ Previous')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(page === 0),
          new ButtonBuilder()
            .setCustomId('next')
            .setLabel('Next ⏩')
            .setStyle(ButtonStyle.Primary)
            .setDisabled((page + 1) * ITEMS_PER_PAGE >= items.length)
        )
      );

      return rows;
    };

    /* ===========================
       Initial render
    =========================== */

    const message = await interaction.editReply({
      embeds: [buildEmbed()],
      components: buildButtons(user)
    });

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 120_000
    });

    /* ===========================
       Button logic
    =========================== */

    collector.on('collect', async (btn) => {
      if (btn.user.id !== userId) {
        return btn.reply({
          content: '❌ These visions are not meant for you.',
          flags: MessageFlags.Ephemeral
        });
      }

      user = await getUserById(userId) || user;

      if (btn.customId === 'prev') {
        page = Math.max(0, page - 1);
        return btn.update({ embeds: [buildEmbed()], components: buildButtons(user) });
      }

      if (btn.customId === 'next') {
        page = Math.min(Math.ceil(items.length / ITEMS_PER_PAGE) - 1, page + 1);
        return btn.update({ embeds: [buildEmbed()], components: buildButtons(user) });
      }

      const [action, raw] = btn.customId.split('_');
      const itemName = raw.replace(/_/g, ' ');
      const item = items.find(i => i.Name.toLowerCase() === itemName.toLowerCase());

      if (!item) {
        return btn.reply({ content: '❌ That item has vanished.', flags: MessageFlags.Ephemeral });
      }

      const owned = safeString(user.Treasure).split(',').map(v => v.trim()).filter(Boolean);
      const price = safeNumber(item.Price);

      /* ===========================
         BUY
      =========================== */

      if (action === 'buy') {
        let remaining = price;
        const cash = safeNumber(user.Cash);
        const bank = safeNumber(user.Bank);

        if (cash + bank < price) {
          return btn.reply({ content: '💰 You lack the funds.', flags: MessageFlags.Ephemeral });
        }

        if (cash >= remaining) {
          user.Cash = cash - remaining;
        } else {
          remaining -= cash;
          user.Cash = 0;
          user.Bank = bank - remaining;
        }

        owned.push(item.Name);
        user.Treasure = owned.join(', ');

        await updateUser(userId, {
          Cash: user.Cash,
          Bank: user.Bank,
          Treasure: user.Treasure
        });

        await btn.reply({
          content: `✅ **${item.Name}** acquired.`,
          flags: MessageFlags.Ephemeral
        });
      }

      /* ===========================
         SELL
      =========================== */

      if (action === 'sell') {
        const index = owned.indexOf(item.Name);
        if (index === -1) {
          return btn.reply({ content: '⚠️ You do not own this.', flags: MessageFlags.Ephemeral });
        }

        owned.splice(index, 1);
        user.Treasure = owned.join(', ');
        user.Cash = safeNumber(user.Cash) + price;

        await updateUser(userId, {
          Cash: user.Cash,
          Treasure: user.Treasure
        });

        await btn.reply({
          content: `💫 **${item.Name}** traded for $${price}.`,
          flags: MessageFlags.Ephemeral
        });
      }

      user = await getUserById(userId) || user;
      await message.edit({ embeds: [buildEmbed()], components: buildButtons(user) });
    });

    collector.on('end', () => {
      message.edit({ components: [] }).catch(() => {});
    });
  }
};
