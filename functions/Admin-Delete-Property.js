const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { getPropertyList } = require('../utils/dbUtils');
const supabase = require('../utils/supabase');
const { logTransaction } = require('../functions/transactionLogger');

const ADMIN_ROLE_ID = '1296986358765719600';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('admin-delete-property')
    .setDescription('Delete a property from The Frontier by Key (UUID).')
    .setDefaultMemberPermissions(0)
    .addStringOption(option =>
      option.setName('key')
        .setDescription('The UUID key of the property to delete.')
        .setRequired(true)
    ),

  async execute(interaction) {
    if (!interaction.member.roles.cache.has(ADMIN_ROLE_ID)) {
      return interaction.reply({
        content: '🚫 You do not have permission to use this command.',
        flags: MessageFlags.Ephemeral
      });
    }

    const key = interaction.options.getString('key').trim();

    try {
      // Fetch property for confirmation/logging
      const propertyList = await getPropertyList();
      const property = propertyList.find(p => p.Key === key);

      if (!property) {
        return interaction.reply({
          content: `⚠️ No property found with Key:\n\`${key}\``,
          flags: MessageFlags.Ephemeral
        });
      }

      // Delete the row by Key
      const { error } = await supabase
        .from('property_list')
        .delete()
        .eq('Key', key);

      if (error) throw error;

      // Log transaction
      logTransaction({
        command: 'admin-delete-property',
        userId: interaction.user.id,
        username: interaction.user.username,
        guildId: interaction.guildId,
        amount: property.Price || 0,
        source: 'Admin Property Deletion',
        metadata: {
          propertyKey: key,
          propertyName: property.Name,
          propertyType: property.Type,
          adminId: interaction.user.id,
          adminUsername: interaction.user.username
        }
      });

      // Confirmation embed
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('🏚️ Property Deleted')
        .setDescription(`**${property.Name}** has been permanently removed.`)
        .addFields(
          { name: '🔑 Key', value: `\`${key}\`` },
          { name: '💰 Price', value: `$${(property.Price || 0).toLocaleString()}`, inline: true },
          { name: '🏷️ Type', value: property.Type || 'Unknown', inline: true },
          { name: '📍 Location', value: property.Location || 'Unknown', inline: true }
        )
        .setFooter({ text: 'The Bot in Black | Coded by BrennanSauce' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });

    } catch (err) {
      console.error('admin-delete-property error:', err);
      return interaction.reply({
        content: '❌ Failed to delete the property.',
        flags: MessageFlags.Ephemeral
      });
    }
  }
};
