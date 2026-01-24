const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { getUserById, updateUser } = require('../utils/dbUtils');
const { logTransaction } = require('../functions/transactionLogger');

const ALLOWED_ROLE_ID = '1296986358765719600';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('admin-remove-warrant')
    .setDescription('Clear a user’s active warrant.')
    .setDefaultMemberPermissions(0)
    .addUserOption(option =>
      option.setName('target')
        .setDescription('The user to clear the warrant for.')
        .setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    if (!interaction.member.roles.cache.has(ALLOWED_ROLE_ID)) {
      return interaction.editReply({
        content: '⛔ **You do not have the required role to use this command.**',
        flags: MessageFlags.Ephemeral
      });
    }

    const targetUser = interaction.options.getUser('target');

    try {
      // -----------------------------
      // Load User
      // -----------------------------
      const userData = await getUserById(targetUser.id);

      if (!userData) {
        return interaction.editReply({
          content: `❌ **User <@${targetUser.id}> not found in the database.**`,
          flags: MessageFlags.Ephemeral
        });
      }

      if (!userData.Warrant) {
        return interaction.editReply({
          content: `✅ **<@${targetUser.id}> does not have an active warrant.**`,
          flags: MessageFlags.Ephemeral
        });
      }

      // -----------------------------
      // Clear Warrant + Reset Fields
      // -----------------------------
      userData.Warrant = false;
      userData.Rate = 0;
      userData.Tax = new Date().toISOString();

      await updateUser(targetUser.id, userData);

      // -----------------------------
      // Transaction Log
      // -----------------------------
      logTransaction({
        command: 'admin-remove-warrant',
        userId: targetUser.id,
        username: targetUser.username,
        amount: 0,
        source: 'Admin Warrant Removal',
        guildId: interaction.guildId,
        metadata: {
          adminId: interaction.user.id,
          adminUsername: interaction.user.username
        }
      });

      // -----------------------------
      // Confirmation Message
      // -----------------------------
      return interaction.editReply({
        content:
          `✅ **Warrant for <@${targetUser.id}> has been cleared.**\n` +
          `🗓️ Tax date updated.\n` +
          `💰 Rate reset to $0.`,
        flags: MessageFlags.Ephemeral
      });

    } catch (error) {
      console.error('Error in /admin-remove-warrant:', error);
      return interaction.editReply({
        content: '❌ **Failed to clear the warrant.** Please try again later.',
        flags: MessageFlags.Ephemeral
      });
    }
  }
};
