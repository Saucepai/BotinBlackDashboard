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
    .setName('property-store')
    .setDescription('🏘️ Browse and purchase properties in the frontier.'),

  async execute(interaction) {
    try {
      await interaction.deferReply();

      const userId = interaction.user.id;
      const username = interaction.user.username;
      const guildId = interaction.guild?.id ?? null;

      const user = await getUserById(userId);
      if (!user) {
        return interaction.editReply({
          content: '❌ You are not registered in the database.',
          flags: MessageFlags.Ephemeral
        });
      }

      const properties = await getPropertyList();
      if (!properties || properties.length === 0) {
        return interaction.editReply({
          content: '📜 No properties are currently listed.',
          flags: MessageFlags.Ephemeral
        });
      }

      let index = 0;

      const normalizeBool = v => v === true || v === 'true';

      const TYPE_COLUMN_MAP = {
        Outlaw: 'Outlaw',
        Ranch: 'Ranch',
        SmallBusiness: 'SmallBusiness',
        BigBusiness: 'BigBusiness',
        Utility: 'Utility',
        Homestead: 'Homestead'
      };

      const embedFor = prop => {
        const details = (prop.Details ?? 'No details available')
          .replace(/\s+/g, ' ')
          .trim();

        return new EmbedBuilder()
          .setColor(0x8b4513)
          .setTitle(prop.Name || 'Unnamed Property')
          .addFields(
            { name: '💰 Price', value: `$${prop.Price}` ?? 'Unknown', inline: true },
            { name: '📦 Type', value: prop.Type ?? 'Unknown', inline: true },
            { name: '👤 Owner', value: prop.Owner ?? 'For Sale', inline: true },
            { name: '📃 Details', value: details }
          )
          .setFooter({ text: `Page ${index + 1} of ${properties.length}` })
          .setTimestamp();
      };

      const buttonsFor = () => {
        const prop = properties[index];
        const ownedByUser = Number(prop.UserID) === Number(userId);
        const isOwned = prop.UserID !== null;

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('prev')
            .setLabel('⬅️')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(index === 0),

          new ButtonBuilder()
            .setCustomId('next')
            .setLabel('➡️')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(index === properties.length - 1),

          new ButtonBuilder()
            .setCustomId('buy')
            .setLabel('💰 Purchase')
            .setStyle(ButtonStyle.Success)
            .setDisabled(isOwned)
        );

        if (ownedByUser) {
          row.addComponents(
            new ButtonBuilder()
              .setCustomId('sell')
              .setLabel('💸 Sell')
              .setStyle(ButtonStyle.Danger)
          );
        }

        return row;
      };

      const message = await interaction.editReply({
        embeds: [embedFor(properties[index])],
        components: [buttonsFor()],
        fetchReply: true
      });

      const collector = message.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 5 * 60 * 1000
      });

      collector.on('collect', async btn => {
        try {
          if (btn.user.id !== userId) {
            return btn.reply({
              content: '❌ This is not your interaction.',
              flags: MessageFlags.Ephemeral
            });
          }

          if (btn.customId === 'prev') index--;
          if (btn.customId === 'next') index++;

          const prop = properties[index];
          const propType = prop.Type;
          const typeColumn = TYPE_COLUMN_MAP[propType];

          /* ========================= BUY ========================= */

          if (btn.customId === 'buy') {
            if (prop.UserID !== null) {
              return btn.reply({ content: '❌ This property is already owned.', flags: MessageFlags.Ephemeral });
            }

            if (typeColumn && typeColumn !== 'Homestead' && normalizeBool(user[typeColumn])) {
              return btn.reply({
                content: `⚠️ You already own a ${propType}.`,
                flags: MessageFlags.Ephemeral
              });
            }

            const price = Number(prop.Price);
            const cashBefore = Number(user.Cash ?? 0);
            const bankBefore = Number(user.Bank ?? 0);

            if (cashBefore + bankBefore < price) {
              return btn.reply({
                content: `💸 You need $${price} to purchase this property.`,
                flags: MessageFlags.Ephemeral
              });
            }

            const confirmRow = new ActionRowBuilder().addComponents(
              new ButtonBuilder().setCustomId('confirm_buy').setLabel('✅ Confirm Purchase').setStyle(ButtonStyle.Success),
              new ButtonBuilder().setCustomId('cancel_buy').setLabel('❌ Cancel').setStyle(ButtonStyle.Secondary)
            );

            const confirmMsg = await btn.reply({
              embeds: [
                new EmbedBuilder()
                  .setTitle('🤝 Confirm Purchase')
                  .setDescription(`Buy **${prop.Name}** for **$${price}**?`)
                  .setColor(0xdaa520)
              ],
              components: [confirmRow],
              fetchReply: true
            });

            const confirmCollector = confirmMsg.createMessageComponentCollector({
              filter: b => b.user.id === userId,
              time: 60_000
            });

            confirmCollector.on('collect', async c => {
              if (c.customId === 'cancel_buy') {
                return c.update({ content: '❌ Purchase cancelled.', embeds: [], components: [] });
              }

              let cash = cashBefore;
              let bank = bankBefore;
              let remaining = price;

              if (cash >= remaining) cash -= remaining;
              else {
                remaining -= cash;
                cash = 0;
                bank -= remaining;
              }

              const updatedProps = user.Properties
                ? `${user.Properties}, ${prop.Name}`
                : prop.Name;

              const updates = {
                Cash: cash,
                Bank: bank,
                Properties: updatedProps
              };

              if (typeColumn === 'Homestead') {
                updates.Homestead = true;
                updates.HomesteadCount = Number(user.HomesteadCount ?? 0) + 1;
              } else if (typeColumn) {
                updates[typeColumn] = true;
              }

              await updateUser(userId, updates);

              prop.Owner = username;
              prop.UserID = Number(userId);
              await writePropertyList(properties);

              logTransaction({
                command: 'property-store-buy',
                userId,
                username,
                guildId,
                amount: price,
                balanceBefore: cashBefore + bankBefore,
                balanceAfter: cash + bank,
                source: 'Store Bought Property',
                metadata: { property: prop.Name }
              });

              await c.update({
                embeds: [
                  new EmbedBuilder()
                    .setTitle('🏡 Property Purchased')
                    .setDescription(`You bought **${prop.Name}** for **$${price}**.`)
                    .setColor(0x2ecc71)
                ],
                components: []
              });

              await message.edit({
                embeds: [embedFor(prop)],
                components: [buttonsFor()]
              });
            });
          }

          /* ========================= SELL ========================= */

          if (btn.customId === 'sell') {
            if (Number(prop.UserID) !== Number(userId)) {
              return btn.reply({ content: '❌ You do not own this property.', flags: MessageFlags.Ephemeral });
            }

            const salePrice = Number(prop.Price);
            const cashBefore = Number(user.Cash ?? 0);

            const confirmRow = new ActionRowBuilder().addComponents(
              new ButtonBuilder().setCustomId('confirm_sell').setLabel('✅ Confirm Sale').setStyle(ButtonStyle.Danger),
              new ButtonBuilder().setCustomId('cancel_sell').setLabel('❌ Cancel').setStyle(ButtonStyle.Secondary)
            );

            const confirmMsg = await btn.reply({
              embeds: [
                new EmbedBuilder()
                  .setTitle('💸 Confirm Sale')
                  .setDescription(`Sell **${prop.Name}** for **$${salePrice}**?`)
                  .setColor(0xcd5c5c)
              ],
              components: [confirmRow],
              fetchReply: true
            });

            const confirmCollector = confirmMsg.createMessageComponentCollector({
              filter: b => b.user.id === userId,
              time: 60_000
            });

            confirmCollector.on('collect', async c => {
              if (c.customId === 'cancel_sell') {
                return c.update({ content: '❌ Sale cancelled.', embeds: [], components: [] });
              }

              const updates = {
                Cash: cashBefore + salePrice,
                Properties: (user.Properties ?? '')
                  .split(', ')
                  .filter(p => p !== prop.Name)
                  .join(', ')
              };

              if (typeColumn === 'Homestead') {
                const count = Math.max(0, Number(user.HomesteadCount ?? 1) - 1);
                updates.HomesteadCount = count;
                updates.Homestead = count > 0;
              } else if (typeColumn) {
                updates[typeColumn] = false;
              }

              await updateUser(userId, updates);

              prop.Owner = null;
              prop.UserID = null;
              await writePropertyList(properties);

              logTransaction({
                command: 'property-store-sell',
                userId,
                username,
                guildId,
                amount: salePrice,
                balanceBefore: cashBefore,
                balanceAfter: cashBefore + salePrice,
                source: 'Store Sold Property',
                metadata: { property: prop.Name }
              });

              await c.update({
                embeds: [
                  new EmbedBuilder()
                    .setTitle('🤝 Property Sold')
                    .setDescription(`You sold **${prop.Name}** for **$${salePrice}**.`)
                    .setColor(0x20b2aa)
                ],
                components: []
              });

              await message.edit({
                embeds: [embedFor(prop)],
                components: [buttonsFor()]
              });
            });
          }

          await btn.update({
            embeds: [embedFor(properties[index])],
            components: [buttonsFor()]
          });

        } catch (err) {
          console.error('PROPERTY STORE BUTTON ERROR:', err);
        }
      });

      collector.on('end', async () => {
        await message.edit({ components: [] }).catch(() => {});
      });

    } catch (err) {
      console.error('PROPERTY STORE ERROR:', err);
      await interaction.editReply('💥 A serious error occurred while processing this command.');
    }
  }
};
