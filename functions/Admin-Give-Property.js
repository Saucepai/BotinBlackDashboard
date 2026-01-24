const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { getUserById, updateUser, getPropertyList, writePropertyList } = require('../utils/dbUtils');
const { logTransaction } = require('../functions/transactionLogger');

const ADMIN_ROLE_ID = '1296986358765719600';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('admin-give-property')
    .setDescription('Give a property to a user.')
    .setDefaultMemberPermissions(0)
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to whom you want to give the property.')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('property')
        .setDescription('The name of the property to give.')
        .setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    if (!interaction.member.roles.cache.has(ADMIN_ROLE_ID)) {
      return interaction.editReply({
        content: '⛔ **You do not have permission to use this command.**',
        flags: MessageFlags.Ephemeral
      });
    }

    const targetUser = interaction.options.getUser('user');
    const propertyInput = interaction.options.getString('property').trim().toLowerCase();

    try {
      // -----------------------------
      // Load User
      // -----------------------------
      const userData = await getUserById(targetUser.id);

      if (!userData) {
        return interaction.editReply({
          content: '**User data not found in the database.**',
          flags: MessageFlags.Ephemeral
        });
      }

      // -----------------------------
      // Load Property List
      // -----------------------------
      const propertyList = await getPropertyList();

      const property = propertyList.find(
        p => p.Name && p.Name.toLowerCase() === propertyInput
      );

      if (!property) {
        return interaction.editReply({
          content: `❌ **Property "${propertyInput}" not found in the property list.**`,
          flags: MessageFlags.Ephemeral
        });
      }

      // -----------------------------
      // Assign Property
      // -----------------------------
      const ownedProperties = userData.Properties
        ? userData.Properties.split(', ').filter(Boolean)
        : [];

      if (!ownedProperties.includes(property.Name)) {
        ownedProperties.push(property.Name);
      }

      userData.Properties = ownedProperties.join(', ');

      property.UserID = targetUser.id;
      property.Owner = interaction.user.tag;

      // -----------------------------
      // Persist Changes
      // -----------------------------
      await updateUser(targetUser.id, userData);
      await writePropertyList(propertyList);

      // -----------------------------
      // Transaction Log
      // -----------------------------
      logTransaction({
        command: 'admin-give-property',
        userId: targetUser.id,
        username: targetUser.username,
        amount: 0,
        source: 'Admin Give Player a Property',
        guildId: interaction.guildId,
        metadata: {
          propertyName: property.Name,
          adminId: interaction.user.id,
          adminUsername: interaction.user.username
        }
      });

      // -----------------------------
      // Confirmation Embed
      // -----------------------------
      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('Property Granted')
        .setDescription(
          `🏠 **${property.Name}** has been successfully granted to **${targetUser.username}**.`
        )
        .setTimestamp()
        .setFooter({ text: 'The Bot in Black | Coded by BrennanSauce' });

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Error in /admin-give-property:', error);
      return interaction.editReply({
        content: '**❌ There was an error while giving the property.** Please try again later.',
        flags: MessageFlags.Ephemeral
      });
    }
  },
};
