const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { getUserById } = require('../utils/dbUtils');
const { logTransaction } = require('../functions/transactionLogger');

const ADMIN_ROLE_ID = '1296986358765719600';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('admin-inventory-search')
    .setDescription('View another player’s inventory (Admins Only).')
    .setDefaultMemberPermissions(0)
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The player whose Satchel you want to take a gander at.')
        .setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    if (!interaction.member.roles.cache.has(ADMIN_ROLE_ID)) {
      const requiredRole = interaction.guild.roles.cache.get(ADMIN_ROLE_ID);
      return interaction.editReply({
        content: `🤠 Whoa there, partner! You need to be a **${requiredRole ? requiredRole.name : 'qualified outlaw'}** to peek into other folks' inventories.`,
        flags: MessageFlags.Ephemeral
      });
    }

    const targetUser = interaction.options.getUser('user');

    try {
      const userData = await getUserById(targetUser.id);

      if (!userData) {
        return interaction.editReply({
          content: `**User data for ${targetUser.username} not found in the database.**`,
          flags: MessageFlags.Ephemeral
        });
      }

      // -----------------------------
      // Helper functions
      // -----------------------------
      const capitalizeWords = (str) =>
        str
          .split(', ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(', ');

      const countDuplicates = (itemsRaw) => {
        if (!itemsRaw) return {};
        const list = itemsRaw.split(', ').map(i => i.trim()).filter(Boolean);
        const counts = {};
        for (const item of list) {
          const key = item.toLowerCase();
          counts[key] = (counts[key] || 0) + 1;
        }
        return counts;
      };

      const formatCounts = (countsObj, emptyMsg) => {
        const entries = Object.entries(countsObj);
        if (entries.length === 0) return emptyMsg;
        return (
          entries
            .map(([item, count]) => {
              const formatted = item.charAt(0).toUpperCase() + item.slice(1);
              return count > 1 ? ` ${formatted} **${count}x**` : ` ${formatted}`;
            })
            .join(', ') + '.'
        );
      };

      // -----------------------------
      // Inventory Processing
      // -----------------------------
      const horsesDisplay = formatCounts(countDuplicates(userData.Horses), 'No horses owned.');
      const treasureDisplay = formatCounts(countDuplicates(userData.Treasure), 'No treasures owned.');

      const foodCounts = countDuplicates(userData.Food);
      const potionCounts = countDuplicates(userData.Potion);
      const huntingCounts = countDuplicates(userData.Hunting);
      const consumableCounts = countDuplicates(userData.Consumable);

      const allConsumableCounts = { ...foodCounts };
      for (const [k, v] of Object.entries(potionCounts)) allConsumableCounts[k] = (allConsumableCounts[k] || 0) + v;
      for (const [k, v] of Object.entries(huntingCounts)) allConsumableCounts[k] = (allConsumableCounts[k] || 0) + v;
      for (const [k, v] of Object.entries(consumableCounts)) allConsumableCounts[k] = (allConsumableCounts[k] || 0) + v;

      const consumablesDisplay = formatCounts(allConsumableCounts, 'No consumables owned.');
      const gunsDisplay = userData.Guns ? capitalizeWords(userData.Guns) + '.' : 'No items owned.';
      const propertiesDisplay = userData.Properties ? capitalizeWords(userData.Properties) + '.' : 'No properties owned.';
      const licensesDisplay = userData.License ? capitalizeWords(userData.License) + '.' : 'No licenses owned.';
      const otherDisplay = userData.Other ? capitalizeWords(userData.Other) + '.' : 'No other items owned.';

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

      // -----------------------------
      // Admin Access Log
      // -----------------------------
      logTransaction({
        command: 'admin-inventory-search',
        userId: targetUser.id,
        username: targetUser.username,
        guildId: interaction.guildId,
        source: 'Admin Inventory Search',
        metadata: {
          adminId: interaction.user.id,
          adminUsername: interaction.user.username
        }
      });

      const embed = new EmbedBuilder()
        .setColor(0xC0B283)
        .setTitle(`${targetUser.username}'s Inventory Overview`)
        .setDescription('Here’s what this outlaw’s packin’ out on the wild frontier.')
        .setThumbnail('https://cdn2.iconfinder.com/data/icons/wild-west-flat-colorful/2048/6230_-_Shop-512.png')
        .addFields(
          { name: '💼 **Monetary Totals**', value: totalBalanceField, inline: false },
          { name: '🎟️ **Coupons**', value: `They’ve got **${coupons}** coupon${coupons === 1 ? '' : 's'} tucked away.`, inline: false },
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

      return interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Error in /admin-inventory-search:', error);
      return interaction.editReply({
        content: '⚠️ An error occurred while pullin’ their inventory from the saddlebag. Try again shortly, partner.',
        flags: MessageFlags.Ephemeral
      });
    }
  }
};
