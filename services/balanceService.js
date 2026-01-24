// services/balanceService.js
const { supabase } = require('../lib/supabaseClient');
const { logTransaction } = require('../functions/transactionLogger');

const VALID_FIELDS = ['Cash', 'Bank', 'Stash'];

async function updateBalance({
  userId,
  field,
  amount,
  adminId = 'dashboard',  // Placeholder for when admin user accounts are added
  adminUsername = 'Dashboard Admin'  // Placeholder for when admin user accounts are added
}) {
  if (!VALID_FIELDS.includes(field)) {
    throw new Error(`Invalid balance field: ${field}`);
  }

  // 1. Fetch user
  const { data: user, error: fetchError } = await supabase
    .from('users')
    .select('*')
    .eq('UserID', userId)
    .single();

  if (fetchError || !user) {
    throw new Error('User not found');
  }

  const before = Number(user[field]) || 0;
  const after = before + amount;

  if (after < 0) {
    throw new Error(`${field} balance cannot go below zero`);
  }

  // 2. Update balance
  const { error: updateError } = await supabase
    .from('users')
    .update({ [field]: after })
    .eq('UserID', userId);

  if (updateError) {
    throw updateError;
  }

  // 3. Log transaction
  await logTransaction({
    command: 'dashboard-balance-update',
    userId,
    username: user.Username || 'Unknown',
    amount,
    balanceBefore: before,
    balanceAfter: after,
    source: `Dashboard ${amount > 0 ? 'Add' : 'Remove'} ${field}`,
    metadata: {
      adminId,
      adminUsername,
      field
    }
  });

  return {
    field,
    before,
    after
  };
}

module.exports = {
  updateBalance
};
