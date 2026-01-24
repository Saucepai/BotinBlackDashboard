const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { getUserById, updateUser } = require('../utils/dbUtils');
const { logTransaction } = require('../functions/transactionLogger');

const ADMIN_ROLE_ID = '1296986358765719600';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('admin-add-bank')
    .setDescription('Add a specified amount to a user\'s Bank balance.')
    .setDefaultMemberPermissions(0)
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to add funds to.')
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('amount')
        .setDescription('The amount to add to the user\'s bank balance.')
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

      const bankBefore = Number(userData.Bank) || 0;
      const bankAfter = bankBefore + amountToAdd;

      await updateUser(targetUser.id, {
        Bank: bankAfter
      });

      // 🔐 Transaction Log
      logTransaction({
        command: 'admin-add-bank',
        userId: targetUser.id,
        username: targetUser.username,
        guildId: interaction.guildId,
        amount: amountToAdd,
        balanceBefore: bankBefore,
        balanceAfter: bankAfter,
        source: 'Admin Add to Player Bank',
        metadata: {
          adminId: interaction.user.id,
          adminUsername: interaction.user.username
        }
      });

      const embed = new EmbedBuilder()
        .setColor(0x28a745)
        .setTitle('Bank Addition Successful')
        .setDescription(
          `✅ Added $${amountToAdd.toLocaleString()} to ${targetUser.username}’s Bank.` +
          `\nNew Bank balance: $${bankAfter.toLocaleString()}.`
        )
        .setThumbnail('https://www.pngmart.com/files/8/Wallet-PNG-HD-Photo.png')
        .setTimestamp()
        .setFooter({
          text: 'The Bot in Black | Coded by BrennanSauce',
          iconURL: 'https://cdn.discordapp.com/app-icons/977843288176480286/87da08d81c838d165f61ba3b13853c31.png'
        });

      return interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Error in /admin-add-bank:', error);
      return interaction.editReply({
        content: '**❌ Something went wrong processing the request.**',
        flags: MessageFlags.Ephemeral
      });
    }
  }
};
