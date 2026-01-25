const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

function parseList(raw) {
  if (!raw) return [];
  return raw.split(',').map(i => i.trim()).filter(Boolean);
}

function serializeList(list) {
  return list.join(', ');
}

async function updateInventoryItem({
  userId,
  column,
  item,
  action,
  quantity = 1
}) {
  if (!userId || !column || !item || !action) {
    throw new Error('Missing required inventory fields');
  }

  const { data: user, error } = await supabase
    .from('users')
    .select(column)
    .eq('UserID', userId)
    .single();

  if (error || !user) {
    throw new Error('User not found');
  }

  let items = parseList(user[column]);

  if (action === 'add') {
    for (let i = 0; i < quantity; i++) {
      items.push(item);
    }
  }

  if (action === 'remove') {
    for (let i = 0; i < quantity; i++) {
      const index = items.findIndex(
        i => i.toLowerCase() === item.toLowerCase()
      );
      if (index === -1) break;
      items.splice(index, 1);
    }
  }

  const updated = serializeList(items);

  const { error: updateError } = await supabase
    .from('users')
    .update({ [column]: updated })
    .eq('UserID', userId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  return {
    success: true,
    column,
    value: updated
  };
}

module.exports = {
  updateInventoryItem
};
