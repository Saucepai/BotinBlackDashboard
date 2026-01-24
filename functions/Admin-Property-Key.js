const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { getPropertyList } = require('../utils/dbUtils');

const ADMIN_ROLE_ID = '1296986358765719600';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('admin-property-key')
    .setDescription('Retrieve the UUID key for a property.')
    .setDefaultMemberPermissions(0)
    .addStringOption(option =>
      option.setName('name')
        .setDescription('The name of the property.')
        .setRequired(true)
    ),

  async execute(interaction) {
    if (!interaction.member.roles.cache.has(ADMIN_ROLE_ID)) {
      return interaction.reply({
        content: '🚫 You do not have permission to use this command.',
        flags: MessageFlags.Ephemeral
      });
    }

    const name = interaction.options.getString('name').trim();

    try {
      const propertyList = await getPropertyList();

      const property = propertyList.find(
        p => p.Name && p.Name.toLowerCase() === name.toLowerCase()
      );

      if (!property) {
        return interaction.reply({
          content: `⚠️ No property named **"${name}"** was found.`,
          flags: MessageFlags.Ephemeral
        });
      }

      const embed = new EmbedBuilder()
        .setColor(0x00b0f4)
        .setTitle('🔑 Property Key Lookup')
        .setDescription(`Here is the key for **${property.Name}**`)
        .addFields(
          { name: '🔑 UUID Key', value: `\`${property.Key}\`` },
          { name: '💰 Price', value: `$${(property.Price || 0).toLocaleString()}`, inline: true },
          { name: '🏷️ Type', value: property.Type || 'Unknown', inline: true },
          { name: '📍 Location', value: property.Location || 'Unknown', inline: true }
        )
        .setFooter({ text: 'Use this key with /admin-delete-property' })
        .setTimestamp();

      return interaction.reply({
        embeds: [embed],
        flags: MessageFlags.Ephemeral
      });

    } catch (err) {
      console.error('admin-property-key error:', err);
      return interaction.reply({
        content: '❌ Failed to retrieve the property key.',
        flags: MessageFlags.Ephemeral
      });
    }
  }
};
