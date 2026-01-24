function capitalizeWords(str) {
  return str
    .split(', ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(', ');
}

function countDuplicates(itemsRaw) {
  if (!itemsRaw) return {};
  const list = itemsRaw.split(',').map(i => i.trim()).filter(Boolean);
  const counts = {};
  list.forEach(item => {
    const key = item.toLowerCase();
    counts[key] = (counts[key] || 0) + 1;
  });
  return counts;
}

function formatCounts(countsObj, emptyMsg) {
  const entries = Object.entries(countsObj);
  if (entries.length === 0) return emptyMsg;
  return entries.map(([item, count]) => {
    const formatted = item.charAt(0).toUpperCase() + item.slice(1);
    return count > 1 ? `${formatted} (${count}x)` : formatted;
  });
}

function buildInventoryView(userData) {
  const horses = formatCounts(countDuplicates(userData.Horses), 'None');
  const treasure = formatCounts(countDuplicates(userData.Treasure), 'None');

  const consumables = {
    ...countDuplicates(userData.Food),
    ...countDuplicates(userData.Potion),
    ...countDuplicates(userData.Hunting),
    ...countDuplicates(userData.Consumable)
  };

  const guns = {};
  ['Bow', 'Pistol', 'Revolver', 'Rifle', 'Repeater', 'Shotgun'].forEach(type => {
    const raw = userData[type];
    if (!raw) return;
    raw.split(',').map(i => i.trim()).forEach(item => {
      const key = item.toLowerCase();
      guns[key] = (guns[key] || 0) + 1;
    });
  });

  const cash = Number(userData.Cash) || 0;
  const bank = Number(userData.Bank) || 0;
  const stash = Number(userData.Stash) || 0;

  return {
    balances: {
      cash,
      bank,
      stash,
      total: cash + bank + stash
    },
    horses,
    treasure,
    guns: formatCounts(guns, 'None'),
    consumables: formatCounts(consumables, 'None'),
    properties: userData.Properties ? capitalizeWords(userData.Properties) : 'None',
    licenses: userData.License ? capitalizeWords(userData.License) : 'None',
    other: userData.Other ? capitalizeWords(userData.Other) : 'None',
    coupons: Number(userData.Coupons) || 0
  };
}

module.exports = { buildInventoryView };
