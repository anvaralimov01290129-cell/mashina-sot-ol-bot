const { Telegraf, Scenes, session } = require('telegraf');
const express = require('express');

const BOT_TOKEN = '8998326453:AAH1JROgEtTuSGrFsrs4oZCwQylxULDlXwU'; //
const bot = new Telegraf(BOT_TOKEN);
const app = express();

// === MANA SHU YERGA QO'YILADI ===
app.get('/', (req, res) => res.send('Bot 24/7 ishlamoqda!')); //
// ================================

// Keyin qolgan kodlar va eng oxirida portni eshitish boshlanadi:
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

