const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { getUserById } = require('../utils/dbUtils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('inventory')
    .setDescription('View your current inventory.'),

  async execute(interaction) {
    const userId = interaction.user.id;

    try {
      const userData = await getUserById(userId); // ✅ Async-compatible call

      if (!userData) {
        return interaction.reply({
          content: '**User data not found.** Please ensure your user ID is in the database.',
          flags: MessageFlags.Ephemeral
        });
      }

      // Helper functions
      const capitalizeWords = (str) => {
        return str
          .split(', ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(', ');
      };

      const countDuplicates = (itemsRaw) => {
        if (!itemsRaw) return {};
        const list = itemsRaw.split(', ').map(i => i.trim()).filter(Boolean);
        const counts = {};
        list.forEach(item => {
          const key = item.toLowerCase();
          counts[key] = (counts[key] || 0) + 1;
        });
        return counts;
      };

      const formatCounts = (countsObj, emptyMsg) => {
        const entries = Object.entries(countsObj);
        if (entries.length === 0) return emptyMsg;
        return entries.map(([item, count]) => {
          const formatted = item.charAt(0).toUpperCase() + item.slice(1);
          return count > 1 ? ` ${formatted} **${count}x**` : ` ${formatted}`;
        }).join(', ') + '.';
      };

      // 🐎 Horses and 💎 Treasure
      const horsesDisplay = formatCounts(countDuplicates(userData.Horses), 'No horses owned.');
      const treasureDisplay = formatCounts(countDuplicates(userData.Treasure), 'No treasures owned.');

      // 🧳 Consumables from multiple types
      const foodCounts = countDuplicates(userData.Food);
      const potionCounts = countDuplicates(userData.Potion);
      const huntingCounts = countDuplicates(userData.Hunting);
      const consumableCounts = countDuplicates(userData.Consumable);

      const allConsumableCounts = { ...foodCounts };
      for (const [k, v] of Object.entries(potionCounts)) allConsumableCounts[k] = (allConsumableCounts[k] || 0) + v;
      for (const [k, v] of Object.entries(huntingCounts)) allConsumableCounts[k] = (allConsumableCounts[k] || 0) + v;
      for (const [k, v] of Object.entries(consumableCounts)) allConsumableCounts[k] = (allConsumableCounts[k] || 0) + v;

      const consumablesDisplay = formatCounts(allConsumableCounts, 'No consumables owned.');

      // 🔫 Guns from new columns: Bow, Pistol, Revolver, Rifle, Repeater, Shotgun
      const gunCategories = ['Bow', 'Pistol', 'Revolver', 'Rifle', 'Repeater', 'Shotgun'];
      const gunCounts = {};
      gunCategories.forEach(type => {
        const raw = userData[type];
        if (!raw) return;
        const items = raw.split(',').map(i => i.trim()).filter(Boolean);
        items.forEach(item => {
          const key = item.toLowerCase();
          gunCounts[key] = (gunCounts[key] || 0) + 1;
        });
      });

      const gunsDisplay = formatCounts(gunCounts, 'No items owned.');

      // 🏠 Properties, 📜 Licenses, 🎒 Other
      const propertiesDisplay = userData.Properties ? capitalizeWords(userData.Properties) + '.' : 'No properties owned.';
      const licensesDisplay = userData.License ? capitalizeWords(userData.License) + '.' : 'No licenses owned.';
      const otherDisplay = userData.Other ? capitalizeWords(userData.Other) + '.' : 'No other items owned.';

      // 💰 Money
      const cash = Number(userData.Cash) || 0;
      const bank = Number(userData.Bank) || 0;
      const stash = Number(userData.Stash) || 0;
      const coupons = Number(userData.Coupons) || 0;
      const grandTotal = cash + bank + stash;


      const totalBalanceField =
        `💰 **Cash:** $${cash.toLocaleString()}\n` +
        `🏦 **Bank:** $${bank.toLocaleString()}\n` +
        `📦 **Stash:** $${stash.toLocaleString()}\n` +
        `💸 **Grand Total:** $${grandTotal.toLocaleString()}`;

      // 📦 Embed display
      const embed = new EmbedBuilder()
        .setColor(0xC0B283)
        .setTitle(`${interaction.member.displayName}'s Inventory Overview`)
        .setDescription('Here’s what you’ve wrangled up in the wild frontier, partner.')
        .setThumbnail('https://cdn2.iconfinder.com/data/icons/wild-west-flat-colorful/2048/6230_-_Shop-512.png')
        .addFields(
          { name: '💼 **Monetary Totals**', value: totalBalanceField, inline: false },
          { name: '🎟️ **Coupons in Yer Saddlebag**', value: `You’ve got **${coupons}** coupon${coupons === 1 ? '' : 's'} ridin’ along.`, inline: false },
          { name: '🐎 **Owned Horses**', value: horsesDisplay, inline: false },
          { name: '🛠️ **Owned Guns**', value: gunsDisplay, inline: false },
          { name: '🏠 **Owned Properties**', value: propertiesDisplay, inline: false },
          { name: '📜 **Owned Licenses**', value: licensesDisplay, inline: false },
          { name: '💎 **Owned Treasures**', value: treasureDisplay, inline: false },
          { name: '🧳 **Consumables**', value: consumablesDisplay, inline: false },
          { name: '🎒 **Other**', value: otherDisplay, inline: false }
        )
        .setTimestamp()
        .setFooter({
          text: 'The Bot in Black | Coded by BrennanSauce',
          iconURL: 'https://cdn.discordapp.com/app-icons/977843288176480286/87da08d81c838d165f61ba3b13853c31.png'
        })
        .setImage('https://cdn2.iconfinder.com/data/icons/wild-west-flat-colorful/2048/6250_-_Desert-512.png');

      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });

    } catch (error) {
      console.error(error);
      interaction.reply({ content: '⚠️ An error occurred while pullin’ your inventory from the saddlebag. Try again shortly, partner.', flags: MessageFlags.Ephemeral });
    }
  }
};
