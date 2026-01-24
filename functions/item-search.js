const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');

const { getUserById, updateUser, getItemList } = require('../utils/dbUtils');

const itemLimits = {
  pistol: 1,
  license: 1,
  bow: 1,
  rifle: 1,
  repeater: 1,
  shotgun: 1,
  other: 1,
  wagon: 1,
  revolver: 2,
};

const safeString = v => (typeof v === 'string' ? v : '');
const getCategoryField = t => t?.charAt(0).toUpperCase() + t.slice(1).toLowerCase();

function buildQuantityModal(action, itemName, max) {
  return new ModalBuilder()
    .setCustomId(`qty:${action}:${itemName.replace(/\s+/g, '_')}`)
    .setTitle(`${action === 'buy' ? 'Buy' : 'Sell'} Quantity`)
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('quantity')
          .setLabel(`Enter quantity (1–${max})`)
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      )
    );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('item-search')
    .setDescription('Search the general store for items')
    .addStringOption(o =>
      o.setName('name')
       .setDescription('Item name to search for')
       .setRequired(true)
    ),

  async execute(interaction) {
    const query = interaction.options.getString('name')?.trim().toLowerCase();
    const userId = interaction.user.id;

    let user = await getUserById(userId);
    if (!user) return interaction.reply({ content: 'You are not registered in the dusty ledgers.', flags: MessageFlags.Ephemeral });

    const items = (await getItemList()).filter(i => i?.Name?.toLowerCase().includes(query));
    if (!items.length) return interaction.reply({ content: 'No items found in this frontier general store.', flags: MessageFlags.Ephemeral });

    let page = 0;

    // --- EMBED BUILDER ---
    const embedFor = (item, userData) => {
      const cat = getCategoryField(item.Type);
      const owned = safeString(userData[cat])
        .split(',')
        .map(s => s.trim().toLowerCase())
        .filter(Boolean);
      const count = owned.filter(i => i === item.Name.toLowerCase()).length;

      return new EmbedBuilder()
        .setTitle(`🏜️ ${item.Name}`)
        .setColor(0x8B4513)
        .setThumbnail('https://i.imgur.com/OdL0XPt.png')
        .setDescription(
          `💵 **Price:** $${item.Price}\n` +
          `📜 **Type:** ${item.Type}\n` +
          `🔎 ${item.Details || 'No details available.'}\n\n` +
          `🤠 **You Own:** ${count}`
        )
        .setFooter({ text: `Result ${page + 1}/${items.length} | The Frontier General Store` });
    };

    // --- BUTTON COMPONENTS ---
    const componentsFor = (item, userData) => {
      const cat = getCategoryField(item.Type);
      const owned = safeString(userData[cat])
        .split(',')
        .map(s => s.trim().toLowerCase())
        .filter(Boolean);
      const count = owned.filter(i => i === item.Name.toLowerCase()).length;
      const limit = itemLimits[cat?.toLowerCase()] ?? Infinity;
      const totalFunds = (Number(userData.Cash) || 0) + (Number(userData.Bank) || 0);
      const price = Number(item.Price);

      const row = new ActionRowBuilder();
      if (count < limit && totalFunds >= price) {
        row.addComponents(
          new ButtonBuilder().setCustomId('buy').setLabel('Buy').setStyle(ButtonStyle.Success)
        );
      }
      if (count > 0) {
        row.addComponents(
          new ButtonBuilder().setCustomId('sell').setLabel('Sell').setStyle(ButtonStyle.Danger)
        );
      }

      const navRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('prev').setLabel('⏪ Back').setStyle(ButtonStyle.Secondary).setDisabled(page === 0),
        new ButtonBuilder().setCustomId('next').setLabel('Next ⏩').setStyle(ButtonStyle.Secondary).setDisabled(page === items.length - 1)
      );

      return [row, navRow].filter(r => r.components.length);
    };

    // --- SEND INITIAL MESSAGE ---
    const msg = await interaction.reply({
      embeds: [embedFor(items[page], user)],
      components: componentsFor(items[page], user),
      fetchReply: true,
    });

    // --- BUTTON COLLECTOR ---
    const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 300_000 });

    collector.on('collect', async btn => {
      if (btn.user.id !== userId) return btn.reply({ content: "This ain't your transaction, partner.", flags: MessageFlags.Ephemeral });

      user = await getUserById(userId); // fresh user data
      const item = items[page];
      const cat = getCategoryField(item.Type);
      const owned = safeString(user[cat]).split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
      const count = owned.filter(i => i === item.Name.toLowerCase()).length;
      const limit = itemLimits[cat?.toLowerCase()] ?? Infinity;
      const price = Number(item.Price);
      const totalFunds = (Number(user.Cash) || 0) + (Number(user.Bank) || 0);

      if (btn.customId === 'prev') { page--; return btn.update({ embeds: [embedFor(items[page], user)], components: componentsFor(items[page], user) }); }
      if (btn.customId === 'next') { page++; return btn.update({ embeds: [embedFor(items[page], user)], components: componentsFor(items[page], user) }); }

      const action = btn.customId;
      const maxQty = action === 'buy' ? Math.min(limit - count, Math.floor(totalFunds / price)) : count;
      if (maxQty <= 0) return btn.reply({ content: 'You cannot perform this action.', flags: MessageFlags.Ephemeral });

      await btn.showModal(buildQuantityModal(action, item.Name, maxQty));

      try {
        const modal = await btn.awaitModalSubmit({ filter: m => m.user.id === userId, time: 30_000 });
        await modal.deferReply({ ephemeral: true });

        const qty = Number(modal.fields.getTextInputValue('quantity'));
        if (!Number.isInteger(qty) || qty <= 0 || qty > maxQty) return modal.editReply('Invalid quantity.');

        let cash = Number(user.Cash) || 0;
        let bank = Number(user.Bank) || 0;
        let newOwned = safeString(user[cat]).split(',').map(s => s.trim()).filter(Boolean);

        if (action === 'buy') {
          let totalCost = price * qty;
          if (cash >= totalCost) cash -= totalCost;
          else { totalCost -= cash; cash = 0; bank -= totalCost; }
          for (let i = 0; i < qty; i++) newOwned.push(item.Name);
        } else {
          let removed = 0;
          for (let i = newOwned.length - 1; i >= 0 && removed < qty; i--) {
            if (newOwned[i].toLowerCase() === item.Name.toLowerCase()) { newOwned.splice(i, 1); removed++; }
          }
          cash += price * qty;
        }

        await updateUser(userId, { Cash: cash, Bank: bank, [cat]: newOwned.join(', ') });
        user = await getUserById(userId); // refetch updated user

        await modal.editReply(`✅ ${action === 'buy' ? 'Bought' : 'Sold'} ${qty} × **${item.Name}**`);

        // Refresh main message embed & buttons
        await msg.edit({ embeds: [embedFor(items[page], user)], components: componentsFor(items[page], user) });

      } catch {
        return; // modal timeout, do nothing
      }
    });

    collector.on('end', async () => {
      const disabledComponents = componentsFor(items[page], user).map(r => {
        r.components.forEach(c => c.setDisabled(true));
        return r;
      });
      await msg.edit({ components: disabledComponents });
    });
  },
};
