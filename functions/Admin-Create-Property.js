const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { getPropertyList, writePropertyList } = require('../utils/dbUtils');
const { logTransaction } = require('../functions/transactionLogger');
const { randomUUID } = require('crypto');


const ADMIN_ROLE_ID = '1296986358765719600';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('admin-add-property')
    .setDescription('Add a new property to The Frontier property list.')
    .setDefaultMemberPermissions(0)
    .addStringOption(option =>
      option.setName('name')
        .setDescription('The name of the new property.')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option.setName('price')
        .setDescription('The price of the new property.')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('details')
        .setDescription('Details about the property.')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('type')
        .setDescription('Type of the property (e.g., house, business).')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('location')
        .setDescription('Location of the property.')
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
    const price = interaction.options.getInteger('price');
    const details = interaction.options.getString('details').trim();
    const type = interaction.options.getString('type').trim().toLowerCase();
    const location = interaction.options.getString('location').trim();

    try {
      // -----------------------------
      // Load Property List
      // -----------------------------
      const propertyList = await getPropertyList();

      const duplicate = propertyList.find(
        p => p.Name && p.Name.toLowerCase() === name.toLowerCase()
      );

      if (duplicate) {
        return interaction.reply({
          content: `⚠️ A property with the name **"${name}"** already exists.`,
          flags: MessageFlags.Ephemeral
        });
      }

      // -----------------------------
      // Create Property
      // -----------------------------
      const newProperty = {
        Key: randomUUID(),
        Name: name,
        Price: price,
        Details: details,
        Type: type,
        Location: location,
        UserID: null,
        Owner: null
      };

      propertyList.push(newProperty);

      await writePropertyList(propertyList);

      // -----------------------------
      // Transaction Log
      // -----------------------------
      logTransaction({
        command: 'admin-add-property',
        userId: null,
        username: null,
        amount: price,
        source: 'Admin Add Property to Database',
        guildId: interaction.guildId,
        metadata: {
          propertyName: name,
          propertyType: type,
          adminId: interaction.user.id,
          adminUsername: interaction.user.username
        }
      });

      // -----------------------------
      // Confirmation Embed
      // -----------------------------
      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('🏠 Property Added Successfully')
        .setDescription(`The property **${name}** has been added to the Frontier.`)
        .addFields(
          { name: '💰 Price', value: `$${price.toLocaleString()}`, inline: true },
          { name: '🏷️ Type', value: type, inline: true },
          { name: '📍 Location', value: location, inline: true },
          { name: '📜 Details', value: details }
        )
        .setTimestamp()
        .setFooter({ text: 'The Bot in Black | Coded by BrennanSauce' });

      return interaction.reply({ embeds: [embed] });

    } catch (error) {
      console.error('Error in /admin-add-property:', error);
      return interaction.reply({
        content: '**❌ There was an error while adding the property.** Please try again later.',
        flags: MessageFlags.Ephemeral
      });
    }
  }
};
