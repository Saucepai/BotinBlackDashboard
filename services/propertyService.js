const { createClient } = require('@supabase/supabase-js');

// ---------------------------
// Supabase client (server only)
// ---------------------------
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Give a property to a user.
 * @param {Object} params - { userId, propertyName, adminTag }
 */
async function giveProperty({ userId, propertyName, adminTag = 'Admin' }) {
  if (!userId || !propertyName) throw new Error('Missing userId or propertyName');

  // --- Fetch user ---
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('UserID', userId)
    .single();
  if (userError || !user) throw new Error('User not found');

  // --- Fetch property ---
  const { data: properties, error: propError } = await supabase
    .from('properties')
    .select('*')
    .eq('Name', propertyName)
    .is('UserID', null);
  if (propError) throw new Error('Property lookup failed');
  if (!properties || properties.length === 0) throw new Error('Property not available');

  const property = properties[0];

  // --- Update user's owned properties ---
  const owned = user.Properties ? user.Properties.split(', ').filter(Boolean) : [];
  if (!owned.includes(property.Name)) owned.push(property.Name);

  // --- Persist changes ---
  await supabase.from('users').update({ Properties: owned.join(', ') }).eq('UserID', userId);
  await supabase.from('properties').update({ UserID: userId, Owner: adminTag }).eq('id', property.id);

  return { success: true, message: `Property "${property.Name}" given to user ${userId}` };
}

/**
 * Remove a property from a user.
 * @param {Object} params - { userId, propertyName }
 */
async function removeProperty({ userId, propertyName }) {
  if (!userId || !propertyName) throw new Error('Missing userId or propertyName');

  // --- Fetch user ---
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('UserID', userId)
    .single();
  if (userError || !user) throw new Error('User not found');

  // --- Fetch property ---
  const { data: properties, error: propError } = await supabase
    .from('properties')
    .select('*')
    .eq('Name', propertyName)
    .eq('UserID', userId);
  if (propError) throw new Error('Property lookup failed');
  if (!properties || properties.length === 0) throw new Error('Property not owned by user');

  const property = properties[0];

  // --- Update user's owned properties ---
  const owned = user.Properties ? user.Properties.split(', ').filter(p => p !== property.Name) : [];
  await supabase.from('users').update({ Properties: owned.join(', ') }).eq('UserID', userId);

  // --- Clear ownership from property ---
  await supabase.from('properties').update({ UserID: null, Owner: null }).eq('id', property.id);

  return { success: true, message: `Property "${property.Name}" removed from user ${userId}` };
}

/**
 * Delete a property entirely (only if unowned)
 * @param {Object} params - { propertyName }
 */
async function deleteProperty({ propertyName }) {
  if (!propertyName) throw new Error('Missing propertyName');

  // --- Check property ownership ---
  const { data: properties, error } = await supabase
    .from('properties')
    .select('*')
    .eq('Name', propertyName)
    .is('UserID', null);
  if (error) throw new Error('Property lookup failed');
  if (!properties || properties.length === 0) throw new Error('Property not found or currently owned');

  await supabase.from('properties').delete().eq('Name', propertyName);
  return { success: true, message: `Property "${propertyName}" deleted` };
}

module.exports = { giveProperty, removeProperty, deleteProperty };
