const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { getUserById, updateUser } = require('../utils/dbUtils');
const { logTransaction } = require('../functions/transactionLogger');

const ADMIN_ROLE_ID = '1296986358765719600';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('admin-remove-fines')
    .setDescription('Remove a specified amount from a user\'s Fines. If cleared, warrant is removed.')
    .setDefaultMemberPermissions(0)
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to remove fines from.')
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('amount')
        .setDescription('The amount to remove from the user\'s fines.')
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

      const finesBefore = Number(userData.Fines) || 0;

      if (finesBefore < amountToRemove) {
        return interaction.editReply({
          content: `💸 **Insufficient fines.** ${targetUser.username} has only $${finesBefore} in fines.`,
          flags: MessageFlags.Ephemeral
        });
      }

      let finesAfter = finesBefore - amountToRemove;
      let warrantCleared = false;

      if (finesAfter <= 0) {
        finesAfter = 0;
        warrantCleared = true;
      }

      await updateUser(targetUser.id, {
        Fines: finesAfter,
        Warrant: warrantCleared ? false : userData.Warrant
      });

      // 🔐 Transaction Log
      logTransaction({
        command: 'admin-remove-fines',
        userId: targetUser.id,
        username: targetUser.username,
        guildId: interaction.guildId,
        amount: amountToRemove,
        balanceBefore: finesBefore,
        balanceAfter: finesAfter,
        source: 'Admin Remove Fines',
        metadata: {
          adminId: interaction.user.id,
          adminUsername: interaction.user.username,
          warrantCleared
        }
      });

      const embed = new EmbedBuilder()
        .setColor(0xFFA500)
        .setTitle('Fine Deduction Successful')
        .setDescription(
          `✅ Removed $${amountToRemove} from ${targetUser.username}’s Fines.` +
          `\nNew fine balance: $${finesAfter}.` +
          `${warrantCleared ? '\n🚨 **Warrant has been cleared.**' : ''}`
        )
        .setTimestamp()
        .setFooter({ text: 'The Bot in Black | Coded by BrennanSauce' });

      return interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Error in /admin-remove-fines:', error);
      return interaction.editReply({
        content: '**❌ Something went wrong processing the request.**',
        flags: MessageFlags.Ephemeral
      });
    }
  }
};
