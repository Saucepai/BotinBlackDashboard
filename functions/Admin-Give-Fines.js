const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { getUserById, updateUser } = require('../utils/dbUtils');
const { logTransaction } = require('../functions/transactionLogger');

const ADMIN_ROLE_ID = '1296986358765719600';
const WARRANT_CHANNEL_ID = '1296986363828371551';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('admin-add-fines')
    .setDescription('Add a specified amount to a user\'s Fines. Triggers a warrant at $100 or more.')
    .setDefaultMemberPermissions(0)
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to fine.')
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('amount')
        .setDescription('The amount of fines to add.')
        .setRequired(true)),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    if (!interaction.member.roles.cache.has(ADMIN_ROLE_ID)) {
      return interaction.editReply({
        content: '⛔ **You do not have permission to use this command.**',
        flags: MessageFlags.Ephemeral
      });
    }

    try {
      const targetUser = interaction.options.getUser('user');
      const amountToAdd = interaction.options.getInteger('amount');

      const userData = await getUserById(targetUser.id);

      if (!userData) {
        return interaction.editReply({
          content: '**User data not found in the database.**',
          flags: MessageFlags.Ephemeral
        });
      }

      // -----------------------------
      // Fine Logic
      // -----------------------------
      const previousFines = Number(userData.Fines) || 0;
      userData.Fines = previousFines + amountToAdd;

      let warrantIssued = false;
      if (userData.Fines >= 100) {
        userData.Warrant = true;
        warrantIssued = true;
      }

      await updateUser(targetUser.id, userData);

      // -----------------------------
      // Transaction Log
      // -----------------------------
      logTransaction({
        command: 'admin-add-fines',
        userId: targetUser.id,
        username: targetUser.username,
        amount: amountToAdd,
        balanceAfter: userData.Fines,
        source: 'Admin Fine a Player',
        guildId: interaction.guildId,
        metadata: {
          adminId: interaction.user.id,
          adminUsername: interaction.user.username,
          warrantIssued
        }
      });

      // -----------------------------
      // Admin Confirmation Embed
      // -----------------------------
      const embed = new EmbedBuilder()
        .setColor(0xDC143C)
        .setTitle('Fine Added Successfully')
        .setDescription(
          `💰 Added **$${amountToAdd.toLocaleString()}** to **${targetUser.username}**’s fines.\n` +
          `📄 New fine balance: **$${userData.Fines.toLocaleString()}**.` +
          `${warrantIssued ? '\n\n🚨 **WARRANT ISSUED** 🚨' : ''}`
        )
        .setTimestamp()
        .setFooter({ text: 'The Bot in Black | Coded by BrennanSauce' });

      await interaction.editReply({ embeds: [embed] });

      // -----------------------------
      // Public Warrant Broadcast
      // -----------------------------
      if (warrantIssued) {
        const warrantChannel = interaction.client.channels.cache.get(WARRANT_CHANNEL_ID);

        if (warrantChannel) {
          const warrantEmbed = new EmbedBuilder()
            .setColor(0x8B0000)
            .setTitle('🚨 WANTED INDIVIDUAL')
            .setDescription(`A warrant has been issued for **${targetUser.username}**!`)
            .addFields(
              { name: 'User ID', value: targetUser.id, inline: true },
              { name: 'Total Fines', value: `$${userData.Fines.toLocaleString()}`, inline: true }
            )
            .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
            .setTimestamp()
            .setFooter({ text: 'Justice rides fast in the Wild West...' });

          await warrantChannel.send({ embeds: [warrantEmbed] });
        }
      }

    } catch (error) {
      console.error('Error in /admin-add-fines:', error);
      return interaction.editReply({
        content: '**❌ Something went wrong processing the request.**',
        flags: MessageFlags.Ephemeral
      });
    }
  }
};
