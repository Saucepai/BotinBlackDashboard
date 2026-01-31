const express = require('express');
const router = express.Router();
const { updateInventoryItem } = require('../../services/inventoryMutationService');

router.post('/inventory/update', async (req, res) => {
  try {
    const result = await updateInventoryItem(req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

module.exports = router;
