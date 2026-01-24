const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { getUserById, updateUser } = require('../utils/dbUtils');
const { logTransaction } = require('../functions/transactionLogger');

const ADMIN_ROLE_ID = '1296986358765719600';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('admin-remove-bank')
    .setDescription('Remove a specified amount from a user\'s Bank balance.')
    .setDefaultMemberPermissions(0)
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to remove bank funds from.')
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('amount')
        .setDescription('The amount to remove from the user\'s bank balance.')
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

      const bankBefore = Number(userData.Bank) || 0;

      if (bankBefore < amountToRemove) {
        return interaction.editReply({
          content: `💸 **Insufficient funds.** ${targetUser.username} has only $${bankBefore} in their Bank.`,
          flags: MessageFlags.Ephemeral
        });
      }

      const bankAfter = bankBefore - amountToRemove;

      await updateUser(targetUser.id, {
        Bank: bankAfter
      });

      // 🔐 Transaction Log
      logTransaction({
        command: 'admin-remove-bank',
        userId: targetUser.id,
        username: targetUser.username,
        guildId: interaction.guildId,
        amount: amountToRemove,
        balanceBefore: bankBefore,
        balanceAfter: bankAfter,
        source: 'Admin Remove Bank Funds',
        metadata: {
          adminId: interaction.user.id,
          adminUsername: interaction.user.username
        }
      });

      const embed = new EmbedBuilder()
        .setColor(0xFF6347)
        .setTitle('Bank Removal Successful')
        .setDescription(
          `✅ Removed $${amountToRemove} from ${targetUser.username}’s Bank.` +
          `\nNew Bank balance: $${bankAfter}.`
        )
        .setThumbnail('https://www.pngmart.com/files/8/Wallet-PNG-HD-Photo.png')
        .setTimestamp()
        .setFooter({ text: 'The Bot in Black | Coded by BrennanSauce' });

      return interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Error in /admin-remove-bank:', error);
      return interaction.editReply({
        content: '**❌ Something went wrong processing the request.**',
        flags: MessageFlags.Ephemeral
      });
    }
  }
};
