function capitalizeWords(str) {
  return str
    .split(', ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(', ');
}

function countDuplicates(itemsRaw) {
  if (!itemsRaw) return {};
  return itemsRaw
    .split(',')
    .map(i => i.trim())
    .filter(Boolean)
    .reduce((acc, item) => {
      const key = item.toLowerCase();
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
}

function formatCounts(countsObj, emptyMsg = 'None') {
  const entries = Object.entries(countsObj);
  if (!entries.length) return emptyMsg;
  return entries
    .map(([item, count]) => {
      const formatted = item.charAt(0).toUpperCase() + item.slice(1);
      return count > 1 ? `${formatted} (${count}x)` : formatted;
    })
    .join(', ');
}

function buildInventoryView(userData) {
  const horses = formatCounts(countDuplicates(userData.Horses));
  const treasure = formatCounts(countDuplicates(userData.Treasure));

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

  return {
    balances: {
      cash: Number(userData.Cash) || 0,
      bank: Number(userData.Bank) || 0,
      stash: Number(userData.Stash) || 0,
      total: (Number(userData.Cash) || 0) + (Number(userData.Bank) || 0) + (Number(userData.Stash) || 0)
    },
    horses,
    treasure,
    guns: formatCounts(guns),
    consumables: formatCounts(consumables),
    properties: userData.Properties ? capitalizeWords(userData.Properties) : 'None',
    licenses: userData.License ? capitalizeWords(userData.License) : 'None',
    other: userData.Other ? capitalizeWords(userData.Other) : 'None',
    coupons: Number(userData.Coupons) || 0
  };
}

module.exports = { buildInventoryView };
