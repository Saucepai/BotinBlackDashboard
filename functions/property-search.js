const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  MessageFlags
} = require('discord.js');

const {
  getUserById,
  updateUser,
  getPropertyList,
  writePropertyList
} = require('../utils/dbUtils');

const { logTransaction } = require('../functions/transactionLogger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('property-search')
    .setDescription('🔍 Search frontier properties')
    .addStringOption(opt =>
      opt.setName('name')
        .setDescription('Property name or type')
        .setRequired(true)
    ),

  async execute(interaction) {
    try {
      await interaction.deferReply();

      const userId = String(interaction.user.id);
      const username = interaction.user.username;
      const guildId = interaction.guild?.id ?? null;

      const raw = interaction.options.getString('name');
      if (!raw) {
        return interaction.editReply({
          content: '❌ Invalid search keyword.',
          flags: MessageFlags.Ephemeral
        });
      }

      const keyword = raw.toLowerCase().trim();
      const user = await getUserById(userId);
      if (!user) {
        return interaction.editReply({
          content: '❌ You are not registered.',
          flags: MessageFlags.Ephemeral
        });
      }

      const propertyList = await getPropertyList();

      const results = propertyList.filter(p =>
        (p.Name ?? '').toLowerCase().includes(keyword) ||
        (p.Type ?? '').toLowerCase().includes(keyword)
      );

      if (!results.length) {
        return interaction.editReply({
          content: `🔍 No properties found for **${keyword}**.`,
          flags: MessageFlags.Ephemeral
        });
      }

      let index = 0;

      const embedFor = prop =>

        new EmbedBuilder()
          .setColor(0x8b4513)
          .setTitle(prop.Name)
          .addFields(
            { name: '💰 Price', value: `$${prop.Price}` ?? 'Unknown', inline: true },
            { name: '📦 Type', value: prop.Type ?? 'Unknown', inline: true },
            { name: '👤 Owner', value: prop.Owner ?? 'For Sale', inline: true },
            { name: '📃 Details', value: prop.Details ?? 'Unknown', inline: true }
          )
          .setFooter({ text: `Result ${index + 1} of ${results.length}` });

      const mainButtons = () => {
        const prop = results[index];
        const ownedByUser = String(prop.UserID) === userId;

        return new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('prev')
            .setLabel('⬅️')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(index === 0),

          new ButtonBuilder()
            .setCustomId('next')
            .setLabel('➡️')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(index === results.length - 1),

          new ButtonBuilder()
            .setCustomId('buy')
            .setLabel('💰 Buy')
            .setStyle(ButtonStyle.Success)
            .setDisabled(prop.UserID !== null),

          new ButtonBuilder()
            .setCustomId('sell')
            .setLabel('🏷️ Sell')
            .setStyle(ButtonStyle.Danger)
            .setDisabled(!ownedByUser)
        );
      };

      const confirmButtons = (action) =>
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`confirm_${action}`)
            .setLabel('✅ Confirm')
            .setStyle(ButtonStyle.Success),

          new ButtonBuilder()
            .setCustomId('cancel')
            .setLabel('❌ Cancel')
            .setStyle(ButtonStyle.Secondary)
        );

      const message = await interaction.editReply({
        embeds: [embedFor(results[index])],
        components: [mainButtons()],
        fetchReply: true
      });

      const collector = message.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 300000
      });

      collector.on('collect', async btn => {
        if (btn.user.id !== userId) {
          return btn.reply({
            content: '❌ This is not your interaction.',
            flags: MessageFlags.Ephemeral
          });
        }

        const prop = results[index];

        if (btn.customId === 'prev') index--;
        if (btn.customId === 'next') index++;

        /* ================= BUY ================= */
        if (btn.customId === 'buy') {
          return btn.update({
            embeds: [
              embedFor(prop).setDescription(
                `⚠️ Confirm purchase of **${prop.Name}** for **$${prop.Price}**`
              )
            ],
            components: [confirmButtons('buy')]
          });
        }

        /* ================= SELL ================= */
        if (btn.customId === 'sell') {
          //const salePrice = Math.floor(prop.Price * 0.75); // Make it less than the property value in the store
          const salePrice = Number(prop.Price);
          return btn.update({
            embeds: [
              embedFor(prop).setDescription(
                `⚠️ Confirm sale of **${prop.Name}** for **$${salePrice}**`
              )
            ],
            components: [confirmButtons('sell')]
          });
        }

        if (btn.customId === 'cancel') {
          return btn.update({
            embeds: [embedFor(prop)],
            components: [mainButtons()]
          });
        }

        /* ================= CONFIRM BUY ================= */
        if (btn.customId === 'confirm_buy') {
          let cash = Number(user.Cash ?? 0);
          let bank = Number(user.Bank ?? 0);
          const price = Number(prop.Price);

          if (cash + bank < price) {
            return btn.reply({
              content: '💸 Insufficient funds.',
              flags: MessageFlags.Ephemeral
            });
          }

          let remaining = price;
          if (cash >= remaining) cash -= remaining;
          else {
            remaining -= cash;
            cash = 0;
            bank -= remaining;
          }

          const updatedProperties = user.Properties
            ? `${user.Properties}, ${prop.Name}`
            : prop.Name;

          prop.Owner = username;
          prop.UserID = userId;

          await updateUser(userId, {
            Cash: cash,
            Bank: bank,
            Properties: updatedProperties
          });

          await writePropertyList(propertyList);

          logTransaction({
            command: 'property-buy',
            userId,
            username,
            guildId,
            amount: price,
            balanceBefore: cash + bank + price,
            balanceAfter: cash + bank,
            source: 'property',
            metadata: { property: prop.Name, type: prop.Type }
          });

          return btn.update({
            embeds: [
              new EmbedBuilder()
                .setColor(0x228b22)
                .setTitle('🏡 Property Purchased')
                .setDescription(`You bought **${prop.Name}**.`)
            ],
            components: []
          });
        }

        /* ================= CONFIRM SELL ================= */
        if (btn.customId === 'confirm_sell') {
          //const salePrice = Math.floor(prop.Price * 0.75);  // Make it less than the property value in the store
          const salePrice = Number(prop.Price);
          const cashBefore = Number(user.Cash ?? 0);

          const propertyListCleaned = (user.Properties ?? '')
            .split(',')
            .map(p => p.trim())
            .filter(p => p && p !== prop.Name)
            .join(', ') || null;

          prop.Owner = null;
          prop.UserID = null;

          await updateUser(userId, {
            Cash: cashBefore + salePrice,
            Properties: propertyListCleaned
          });

          await writePropertyList(propertyList);

          logTransaction({
            command: 'property-sell',
            userId,
            username,
            guildId,
            amount: salePrice,
            balanceBefore: cashBefore,
            balanceAfter: cashBefore + salePrice,
            source: 'property',
            metadata: { property: prop.Name, type: prop.Type }
          });

          return btn.update({
            embeds: [
              new EmbedBuilder()
                .setColor(0xb22222)
                .setTitle('🏷️ Property Sold')
                .setDescription(`You sold **${prop.Name}**.`)
            ],
            components: []
          });
        }

        await message.edit({
          embeds: [embedFor(results[index])],
          components: [mainButtons()]
        });
      });

      collector.on('end', async () => {
        await message.edit({ components: [] }).catch(() => {});
      });

    } catch (err) {
      console.error('PROPERTY ERROR:', err);
      await interaction.editReply('💥 A serious error occurred.');
    }
  }
};
