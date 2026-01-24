const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { getUserById, updateUser } = require('../utils/dbUtils');
const { logTransaction } = require('../functions/transactionLogger');

const ADMIN_ROLE_ID = '1296986358765719600';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('admin-remove-cash')
    .setDescription('Remove a specified amount from a user\'s Cash balance.')
    .setDefaultMemberPermissions(0)
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to remove cash from.')
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('amount')
        .setDescription('The amount to remove from the user\'s cash balance.')
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
    const amountToRemove = interaction.options.getInteger('amount');

    try {
      const userData = await getUserById(targetUser.id);

      if (!userData) {
        return interaction.editReply({
          content: '**User data not found in the database.**',
          flags: MessageFlags.Ephemeral
        });
      }

      const cashBefore = Number(userData.Cash) || 0;

      if (cashBefore < amountToRemove) {
        return interaction.editReply({
          content: `💸 **Insufficient funds.** ${targetUser.username} has only $${cashBefore}.`,
          flags: MessageFlags.Ephemeral
        });
      }

      const cashAfter = cashBefore - amountToRemove;

      await updateUser(targetUser.id, {
        Cash: cashAfter
      });

      // 🔐 Transaction Log
      logTransaction({
        command: 'admin-remove-cash',
        userId: targetUser.id,
        username: targetUser.username,
        guildId: interaction.guildId,
        amount: amountToRemove,
        balanceBefore: cashBefore,
        balanceAfter: cashAfter,
        source: 'Admin remove Cash Funds',
        metadata: {
          adminId: interaction.user.id,
          adminUsername: interaction.user.username
        }
      });

      const embed = new EmbedBuilder()
        .setColor(0xFF6347)
        .setTitle('Cash Removal Successful')
        .setDescription(
          `✅ Removed $${amountToRemove} from ${targetUser.username}’s Cash.` +
          `\nNew balance: $${cashAfter}.`
        )
        .setTimestamp()
        .setFooter({ text: 'The Bot in Black | Coded by BrennanSauce' });

      return interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Error in /admin-remove-cash:', error);
      return interaction.editReply({
        content: '**❌ Something went wrong processing the request.**',
        flags: MessageFlags.Ephemeral
      });
    }
  }
};
