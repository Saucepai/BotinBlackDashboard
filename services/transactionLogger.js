const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '..', 'logs');
const LOG_FILE = path.join(LOG_DIR, 'admin.log');

/**
 * Appends a structured transaction record to the log file.
 * Each entry is one JSON object per line (JSONL format).
 */
function logTransaction({
  command,
  userId,
  username,
  guildId = null,
  amount = 0,
  balanceBefore = null,
  balanceAfter = null,
  source = null,
  metadata = {}
}) {
  try {
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    }

    const entry = {
      timestamp: new Date().toISOString(),
      command,
      userId,
      username,
      guildId,
      amount,
      balanceBefore,
      balanceAfter,
      source,
      metadata
    };

    fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + '\n', 'utf8');
  } catch (err) {
    // Logging must NEVER crash the bot
    console.error('[TRANSACTION LOGGER ERROR]', err);
  }
}

module.exports = { logTransaction };
