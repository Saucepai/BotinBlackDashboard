const {
  SlashCommandBuilder,
  EmbedBuilder,
  MessageFlags
} = require('discord.js');

const { getUserById, updateUser } = require('../utils/dbUtils');
const { logTransaction } = require('../functions/transactionLogger');

const ADMIN_ROLE_ID = '1296986358765719600';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('admin-remove-stash')
    .setDescription('Remove a specified amount from a user’s Stash balance.')
    .setDefaultMemberPermissions(0)
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('The user to remove stash from.')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName('amount')
        .setDescription('The amount to remove from the user’s stash.')
        .setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    // 🔒 Permission check
    if (!interaction.member.roles.cache.has(ADMIN_ROLE_ID)) {
      return interaction.editReply({
        content: '⛔ **You do not have permission to use this command.**',
        flags: MessageFlags.Ephemeral
      });
    }

    const targetUser = interaction.options.getUser('user');
    const amountToRemove = interaction.options.getInteger('amount');

    if (amountToRemove <= 0) {
      return interaction.editReply({
        content: '❌ Amount must be greater than zero.',
        flags: MessageFlags.Ephemeral
      });
    }

    try {
      const user = await getUserById(targetUser.id);

      if (!user) {
        return interaction.editReply({
          content: '**User data not found in the database.**',
          flags: MessageFlags.Ephemeral
        });
      }

      const stashBefore = Number(user.Stash ?? 0);

      if (stashBefore < amountToRemove) {
        return interaction.editReply({
          content: `💸 **Insufficient stash.** ${targetUser.username} has only **$${stashBefore}**.`,
          flags: MessageFlags.Ephemeral
        });
      }

      const stashAfter = stashBefore - amountToRemove;

      // 💾 Update database
      await updateUser(targetUser.id, {
        Stash: stashAfter
      });

      // 🧾 Log transaction
      logTransaction({
        command: 'admin-remove-stash',
        userId: targetUser.id,
        username: targetUser.username,
        guildId: interaction.guild?.id ?? null,
        amount: amountToRemove,
        balanceBefore: stashBefore,
        balanceAfter: stashAfter,
        source: 'Admin Remove Stash Funds',
        metadata: {
          adminId: interaction.user.id,
          adminUsername: interaction.user.username
        }
      });

      const embed = new EmbedBuilder()
        .setColor(0xff6347)
        .setTitle('💼 Stash Removal Successful')
        .setDescription(
          `✅ Removed **$${amountToRemove}** from **${targetUser.username}**’s stash.\n\n` +
          `**New Stash Balance:** $${stashAfter}`
        )
        .setTimestamp()
        .setFooter({ text: 'The Bot in Black' });

      return interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('ADMIN REMOVE STASH ERROR:', error);
      return interaction.editReply({
        content: '**❌ Something went wrong processing the request.**',
        flags: MessageFlags.Ephemeral
      });
    }
  }
};
