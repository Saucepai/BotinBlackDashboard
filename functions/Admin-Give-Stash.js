const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { getUserById, updateUser } = require('../utils/dbUtils');
const { logTransaction } = require('../functions/transactionLogger');

const ADMIN_ROLE_ID = '1296986358765719600';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('admin-add-stash')
    .setDescription('Add a specified amount to a user\'s Stash balance.')
    .setDefaultMemberPermissions(0)
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to add stash funds to.')
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('amount')
        .setDescription('The amount to add to the user\'s Stash balance.')
        .setRequired(true)),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    if (!interaction.member.roles.cache.has(ADMIN_ROLE_ID)) {
      return interaction.editReply({
        content: '⛔ **You do not have permission to use this command.**',
        flags: MessageFlags.Ephemeral
      });
    }

    const targetUser = interaction.options.getUser('user');
    const amountToAdd = interaction.options.getInteger('amount');

    try {
      const userData = await getUserById(targetUser.id);

      if (!userData) {
        return interaction.editReply({
          content: `**User data for ${targetUser.username} not found in the database.**`,
          flags: MessageFlags.Ephemeral
        });
      }

      const stashBefore = Number(userData.Stash) || 0;
      const stashAfter = stashBefore + amountToAdd;

      await updateUser(targetUser.id, {
        Stash: stashAfter
      });

      // 🔐 Transaction Log
      logTransaction({
        command: 'admin-add-stash',
        userId: targetUser.id,
        username: targetUser.username,
        guildId: interaction.guildId,
        amount: amountToAdd,
        balanceBefore: stashBefore,
        balanceAfter: stashAfter,
        source: 'Admin Add to Player Stash',
        metadata: {
          adminId: interaction.user.id,
          adminUsername: interaction.user.username
        }
      });

      const embed = new EmbedBuilder()
        .setColor(0x28a745)
        .setTitle('Stash Addition Successful')
        .setDescription(
          `✅ Added $${amountToAdd.toLocaleString()} to ${targetUser.username}’s Stash.` +
          `\nNew Stash balance: $${stashAfter.toLocaleString()}.`
        )
        .setThumbnail('https://www.pngmart.com/files/8/Wallet-PNG-HD-Photo.png')
        .setTimestamp()
        .setFooter({ text: 'The Bot in Black | Coded by BrennanSauce' });

      return interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Error in /admin-add-stash:', error);
      return interaction.editReply({
        content: '**❌ Something went wrong processing the request.**',
        flags: MessageFlags.Ephemeral
      });
    }
  }
};
