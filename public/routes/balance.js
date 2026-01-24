// routes/balance.js
const express = require('express');
const router = express.Router();
const { updateBalance } = require('../services/balanceService');

router.post('/users/balance', async (req, res) => {
  try {
    const { userId, field, amount } = req.body;

    if (!userId || !field || typeof amount !== 'number') {
      return res.status(400).json({
        success: false,
        message: 'Missing or invalid parameters'
      });
    }

    const result = await updateBalance({
      userId,
      field,
      amount,
      adminId: req.session?.user?.id,
      adminUsername: req.session?.user?.username
    });

    res.json({
      success: true,
      message: `${field} updated successfully`,
      newBalance: result.after
    });

  } catch (err) {
    console.error('Balance API error:', err.message);
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
});

module.exports = router;
