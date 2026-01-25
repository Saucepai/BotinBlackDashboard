// services/balanceService.js
const { supabase } = require('../lib/supabaseClient');
// const { logTransaction } = require('../functions/transactionLogger'); // Placeholder

const VALID_FIELDS = ['Cash', 'Bank', 'Stash'];

async function updateBalance({
  userId,
  field,
  amount,
  adminId = 'dashboard',
  adminUsername = 'Dashboard Admin'
}) {
  if (!VALID_FIELDS.includes(field)) {
    throw new Error(`Invalid balance field: ${field}`);
  }

  // 1️⃣ Fetch user
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

  // 2️⃣ Update balance
  const { error: updateError } = await supabase
    .from('users')
    .update({ [field]: after })
    .eq('UserID', userId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  // 3️⃣ Optional: log transaction
  // logTransaction({
  //   command: 'update-balance',
  //   userId,
  //   username: user.Username,
  //   amount,
  //   balanceBefore: before,
  //   balanceAfter: after,
  //   source: 'Dashboard',
  //   metadata: { adminId, adminUsername }
  // });

  return { before, after };
}

module.exports = { updateBalance };
