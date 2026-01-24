require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcrypt');

// ============================
// ROUTES
// ============================

const balanceRoutes = require('./routes/balance');

// ============================
// SERVICES
// ============================

const { getInventoryByUserId } = require('./services/inventoryService');
const {
  giveProperty,
  removeProperty,
  deleteProperty
} = require('./services/propertyService');

// ============================
// AUTH CONFIG
// ============================

const ADMIN_PASSWORD_HASH = process.env.DASHBOARD_PASSWORD_HASH;
if (!ADMIN_PASSWORD_HASH) {
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
        return res.status(401).json({
          success: false,
          message: 'Unauthorized'
        });
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
      if (err) return res.redirect('/login?error=1');
      req.session.authenticated = true;
      res.redirect('/dashboard');
    });
  });

  app.post('/logout', (req, res) =>
    req.session.destroy(() => res.redirect('/login'))
  );

  // ============================
  // STATIC FILES
  // ============================

  app.use(express.static(path.join(__dirname, 'public')));
  app.use('/assets', express.static(path.join(__dirname, 'public/assets')));

  // ============================
  // UI ROUTES
  // ============================

  app.get('/dashboard', requireAuth, (_, res) =>
    res.sendFile(path.join(__dirname, 'public/index.html'))
  );

  app.get('/inventory', requireAuth, (_, res) =>
    res.sendFile(path.join(__dirname, 'public/inventory.html'))
  );

  app.get('/transactions', requireAuth, (_, res) =>
    res.sendFile(path.join(__dirname, 'public/transactions.html'))
  );

  app.get('/properties', requireAuth, (_, res) =>
    res.sendFile(path.join(__dirname, 'public/properties.html'))
  );

  // ============================
  // API ROUTES (SERVICE-BASED)
  // ============================

  // Inventory (read-only)
  app.post('/api/inventory', requireAuth, async (req, res) => {
    try {
      const { userId } = req.body;
      if (!userId) {
        throw new Error('Missing userId');
      }

      const inventory = await getInventoryByUserId(userId);
      res.json({ success: true, inventory });
    } catch (err) {
      res.status(400).json({
        success: false,
        message: err.message
      });
    }
  });

  // Balance (router + service)
  app.use('/api', requireAuth, balanceRoutes);

  // Property management
  const { giveProperty, removeProperty, deleteProperty } = require('./services/propertyService');

app.post('/api/properties/give', requireAuth, async (req, res) => {
  try {
    const result = await giveProperty({ 
      userId: req.body.userId, 
      propertyName: req.body.propertyName, 
      adminTag: req.session.adminTag || 'Admin'
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

app.post('/api/properties/remove', requireAuth, async (req, res) => {
  try {
    const result = await removeProperty(req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

app.post('/api/properties/delete', requireAuth, async (req, res) => {
  try {
    const result = await deleteProperty(req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});


  // ============================
  // START SERVER
  // ============================

  app.listen(PORT, () => {
    console.log(`Dashboard running on port ${PORT}`);
  });
}

module.exports = { startDashboard };
