require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcrypt');
const { createClient } = require('@supabase/supabase-js');

// ============================
// SUPABASE CLIENT (SERVER ONLY)
// ============================

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ============================
// AUTH CONFIG
// ============================

const ADMIN_PASSWORD_HASH = process.env.DASHBOARD_PASSWORD_HASH;

if (!process.env.DASHBOARD_PASSWORD_HASH) {
  throw new Error('DASHBOARD_PASSWORD_HASH is not set');
}


function startDashboard() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());
  app.set('trust proxy', 1);

  // ============================
  // SESSION CONFIG
  // ============================

  app.use(
    session({
      name: 'bot-dashboard',
      secret: process.env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 15 * 60 * 1000
      }
    })
  );

function requireAuth(req, res, next) {
  if (!req.session.authenticated) {
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    return res.redirect('/login');
  }
  next();
}


  // ============================
  // AUTH ROUTES
  // ============================




  app.get('/', (req, res) =>
    res.redirect(req.session.authenticated ? '/dashboard' : '/login')
  );

  app.get('/login', (req, res) =>
    res.sendFile(path.join(__dirname, 'public/login.html'))
  );

app.post('/login', async (req, res) => {
  const valid = await bcrypt.compare(
    req.body.password,
    ADMIN_PASSWORD_HASH
  );

  if (!valid) return res.redirect('/login?error=1');

  req.session.regenerate(err => {
    if (err) {
      return res.redirect('/login?error=1');
    }

    req.session.authenticated = true;
    res.redirect('/dashboard');
  });
});


  app.post('/logout', (req, res) =>
    req.session.destroy(() => res.redirect('/login'))
  );

  app.use(express.static(path.join(__dirname, 'public')));
  app.use('/assets', express.static(path.join(__dirname, 'public/assets')));


  // ============================
  // UI ROUTES
  // ============================

  app.get('/dashboard', requireAuth, (req, res) =>
    res.sendFile(path.join(__dirname, 'public/index.html'))
  );

  app.get('/transactions', requireAuth, (req, res) =>
    res.sendFile(path.join(__dirname, 'public/transactions.html'))
  );

  app.get('/properties', requireAuth, (req, res) =>
    res.sendFile(path.join(__dirname, 'public/properties.html'))
  );

    app.get('/misc', requireAuth, (req, res) =>
    res.sendFile(path.join(__dirname, 'public/misc.html'))
  );


  // ============================
  // BALANCE HELPERS
  // ============================

  async function adjustBalance(res, userId, field, delta) {

        if (!userId || isNaN(delta)) {
  return res.status(400).json({ success: false, message: 'Invalid input' });
}

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('UserID', userId)
      .single();

    if (error || !user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }



    const current = Number(user[field]) || 0;
    if (current + delta < 0) {
      return res.status(400).json({
        success: false,
        message: `Insufficient ${field}. Current: $${current}`
      });
    }

    await supabase
      .from('users')
      .update({ [field]: current + delta })
      .eq('UserID', userId);

    res.json({ success: true, newBalance: current + delta });
  }

  app.post('/api/admin-add-cash', requireAuth, (req, res) =>
    adjustBalance(res, req.body.targetId, 'Cash', Number(req.body.amount))
  );

  app.post('/api/admin-remove-cash', requireAuth, (req, res) =>
    adjustBalance(res, req.body.targetId, 'Cash', -Number(req.body.amount))
  );

  app.post('/api/admin-add-bank', requireAuth, (req, res) =>
    adjustBalance(res, req.body.targetId, 'Bank', Number(req.body.amount))
  );

  app.post('/api/admin-remove-bank', requireAuth, (req, res) =>
    adjustBalance(res, req.body.targetId, 'Bank', -Number(req.body.amount))
  );

  app.post('/api/admin-add-stash', requireAuth, (req, res) =>
    adjustBalance(res, req.body.targetId, 'Stash', Number(req.body.amount))
  );

  app.post('/api/admin-remove-stash', requireAuth, (req, res) =>
    adjustBalance(res, req.body.targetId, 'Stash', -Number(req.body.amount))
  );

  // ============================
  // INVENTORY
  // ============================

  app.post('/api/admin-inventory-search', requireAuth, async (req, res) => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('UserID', req.body.targetId)
      .single();

    if (error || !data) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    res.json({ success: true, inventory: data });
  });

  // ============================
  // PROPERTY MANAGEMENT
  // ============================

  app.post('/api/admin-give-property', requireAuth, async (req, res) => {
    const { targetId, property } = req.body;

    const { data: prop } = await supabase
      .from('properties')
      .select('*')
      .eq('Name', property)
      .is('UserID', null)
      .single();

    if (!prop) return res.status(400).json({ success: false });

    await supabase
      .from('properties')
      .update({ UserID: targetId, Owner: targetId })
      .eq('id', prop.id);

    res.json({ success: true });
  });

  app.post('/api/admin-remove-property', requireAuth, async (req, res) => {
    const { targetId, property } = req.body;

    await supabase
      .from('properties')
      .update({ UserID: null, Owner: null })
      .eq('Name', property)
      .eq('UserID', targetId);

    res.json({ success: true });
  });

  app.post('/api/admin-delete-property', requireAuth, async (req, res) => {
    const { name } = req.body;

    const { error } = await supabase
      .from('properties')
      .delete()
      .eq('Name', name)
      .is('UserID', null);

    if (error) {
      return res.status(400).json({ success: false });
    }

    res.json({ success: true });
  });

  // ============================
  // STATIC + START
  // ============================

  app.listen(PORT, () => {
    console.log(`Dashboard running on port ${PORT}`);
  });

}
module.exports = { startDashboard };

startDashboard();






