const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Scrapes Madam Nazar's current location and posts it to Discord via webhook.
 * No discord.js required.
 */
async function postMadamNazarLocation() {
  let locationText = 'Unknown region';
  let mapImageUrl = null;

  // ============================
  // SCRAPE LOCATION
  // ============================

  try {
    const response = await axios.get('https://rdocollector.com/madam-nazar', {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    const $ = cheerio.load(response.data);

    const bodyText = $('body').text();
    const match = bodyText.match(
      /Madam Nazar is in\s*([A-Za-z\s'-]+?)(?:\s*(?:today|window|map|location|$))/i
    );

    if (match) {
      locationText = match[1].trim().replace(/\s+/g, ' ');
    }

    const imgSrc =
      $('img.border-red-900').attr('src') ||
      $('img[alt*="Madam Nazar" i]').attr('src');

    if (imgSrc) {
      mapImageUrl = imgSrc.startsWith('http')
        ? imgSrc
        : `https://rdocollector.com${imgSrc}`;
    }

  } catch (err) {
    console.error('[Nazar] Scrape failed:', err.message);
  }

  // ============================
  // BUILD EMBED (RAW JSON)
  // ============================

  const embed = {
    color: 0x8B4513,
    title: '🧿 Madam Nazar Location Today',
    description:
      `Madam Nazar is in **${locationText}**\n\n` +
      `🗺️ Full map: https://jeanropke.github.io/RDR2CollectorsMap/`,
    thumbnail: {
      url: 'https://madamnazar.io/static/media/nazar.8b8f8b8b.png'
    },
    timestamp: new Date().toISOString(),
    footer: {
      text: 'The Bot in Black • Daily Location'
    }
  };

  if (mapImageUrl) {
    embed.image = { url: mapImageUrl };
  }

  // ============================
  // POST TO DISCORD WEBHOOK
  // ============================

  if (!process.env.NAZAR_WEBHOOK_URL) {
    throw new Error('NAZAR_WEBHOOK_URL is not set');
  }

  await axios.post(process.env.NAZAR_WEBHOOK_URL, {
    username: 'Madam Nazar',
    avatar_url: 'https://madamnazar.io/static/media/nazar.8b8f8b8b.png',
    embeds: [embed]
  });

  return {
    locationText,
    mapImageUrl
  };
}

module.exports = { postMadamNazarLocation };
