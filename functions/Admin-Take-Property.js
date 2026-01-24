const {
  SlashCommandBuilder,
  EmbedBuilder,
  MessageFlags
} = require('discord.js');

const {
  getUserById,
  updateUser,
  getPropertyList,
  writePropertyList
} = require('../utils/dbUtils');

const { logTransaction } = require('../functions/transactionLogger');

const ADMIN_ROLE_ID = '1296986358765719600';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('admin-remove-property')
    .setDescription('Remove a property from a user’s inventory.')
    .setDefaultMemberPermissions(0)
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('The user whose property you want to remove.')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('property')
        .setDescription('The exact name of the property to remove.')
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
    const rawPropertyName = interaction.options.getString('property');

    const propertyName = rawPropertyName.trim().toLowerCase();

    try {
      // 👤 Fetch user
      const user = await getUserById(targetUser.id);
      if (!user) {
        return interaction.editReply({
          content: '**User not found in the database.**',
          flags: MessageFlags.Ephemeral
        });
      }

      // 📜 Parse owned properties
      const ownedProperties = (user.Properties ?? '')
        .split(',')
        .map(p => p.trim())
        .filter(Boolean);

      const ownedIndex = ownedProperties.findIndex(
        p => p.toLowerCase() === propertyName
      );

      if (ownedIndex === -1) {
        return interaction.editReply({
          content: `❌ **${targetUser.username} does not own that property.**`,
          flags: MessageFlags.Ephemeral
        });
      }

      // 🏠 Fetch property list
      const properties = await getPropertyList();

      const propertyRow = properties.find(
        p => (p.Name ?? '').toLowerCase() === propertyName
      );

      if (!propertyRow) {
        return interaction.editReply({
          content: '❌ Property not found in the property list.',
          flags: MessageFlags.Ephemeral
        });
      }

      // 🧹 Remove property from user inventory
      ownedProperties.splice(ownedIndex, 1);

      await updateUser(targetUser.id, {
        Properties: ownedProperties.length ? ownedProperties.join(', ') : null
      });

      // 🧾 Clear ownership in property_list
      propertyRow.Owner = null;
      propertyRow.UserID = null;

      await writePropertyList(properties);

      // 🧾 Log admin action
      logTransaction({
        command: 'admin-remove-property',
        userId: targetUser.id,
        username: targetUser.username,
        guildId: interaction.guild?.id ?? null,
        amount: 0,
        source: 'Admin Remove a Players Property',
        metadata: {
          property: propertyRow.Name,
          adminId: interaction.user.id,
          adminUsername: interaction.user.username
        }
      });

      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('🏚️ Property Removed')
        .setDescription(
          `✅ **${propertyRow.Name}** has been forcibly removed from **${targetUser.username}**.`
        )
        .setTimestamp()
        .setFooter({ text: 'The Bot in Black' });

      return interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('ADMIN REMOVE PROPERTY ERROR:', error);
      return interaction.editReply({
        content: '**❌ An error occurred while removing the property.**',
        flags: MessageFlags.Ephemeral
      });
    }
  }
};
