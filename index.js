const { Telegraf, Scenes, session } = require('telegraf');
const express = require('express');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');

// Bot tokeni va kanal IDsi
const BOT_TOKEN = '8998326453:AAH1JROgEtTuSGrFsrs4oZCwQylxULDlXwU';
const KANAL_ID = '@mashinasotvasotibol'; 

const bot = new Telegraf(BOT_TOKEN);
const app = express();

const COUNTER_FILE = path.join(__dirname, 'counter.json');

// Avto-inkrement (E'lon raqami) hisoblagichi
function getNextOrderNumber() {
    try {
        if (fs.existsSync(COUNTER_FILE)) {
            const data = fs.readFileSync(COUNTER_FILE, 'utf8');
            const json = JSON.parse(data);
            json.count = (json.count || 0) + 1;
            fs.writeFileSync(COUNTER_FILE, JSON.stringify(json), 'utf8');
            return json.count;
        } else {
            const json = { count: 1 };
            fs.writeFileSync(COUNTER_FILE, JSON.stringify(json), 'utf8');
            return 1;
        }
    } catch (err) {
        return Math.floor(Math.random() * 1000);
    }
}

// === AVTOELON.UZ SAYTIDAN REAL VAQTDA ONLAYN NARXNI OLISH TIZIMI ===
async function getRealAvtoelonPrice(model, year) {
    try {
        let queryModel = model.toLowerCase().trim()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '');

        if (queryModel.includes('nexia-3')) queryModel = 'chevrolet/nexia';
        else if (queryModel.includes('gentra')) queryModel = 'chevrolet/gentra';
        else if (queryModel.includes('cobalt')) queryModel = 'chevrolet/cobalt';
        else if (queryModel.includes('spark')) queryModel = 'chevrolet/spark';
        else if (queryModel.includes('matiz')) queryModel = 'daewoo/matiz';
        else if (!queryModel.includes('/')) queryModel = 'chevrolet/' + queryModel;

        const url = `https://avtoelon.uz/uz/avto/${queryModel}/year-${year}/`;
        
        const response = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });

        const $ = cheerio.load(response.data);
        let prices = [];

        $('.price').each((i, elem) => {
            let priceText = $(elem).text().replace(/[^0-9]/g, ''); 
            let priceNum = parseInt(priceText);
            if (priceNum > 2000 && priceNum < 100000) {
                prices.push(priceNum);
            }
        });

        if (prices.length > 0) {
            const sum = prices.reduce((a, b) => a + b, 0);
            return Math.round(sum / prices.length);
        }
    } catch (error) {
        console.error("Avtoelon ulanishida xatolik:", error.message);
    }
    return null; 
}

// Zaxira kalkulyator (agar Avtoelon sayti vaqtincha javob bermasa)
function calculateBackupPrice(model, year, condition) {
    let price = 11000;
    const m = model.toLowerCase();
    if (m.includes('gentra')) price = 14000;
    else if (m.includes('cobalt')) price = 12500;
    else if (m.includes('nexia 3')) price = 11000;
    else if (m.includes('matiz')) price = 3500;
    
    const diff = 2026 - parseInt(year);
    price -= (diff * 400);
    if (condition === 'yorilgan_urilgan') price -= 1200;
    return price < 2000 ? 2000 : price;
}

// Render uxlab qolmasligi uchun endpoint
app.get('/', (req, res) => res.send('Bot 24/7 ishlamoqda!'));
bot.use(session());

// === E'LON BERISH BOSQIChLARI (WIZARD SCENE) ===
const carAdWizard = new Scenes.WizardScene('CAR_AD_WIZARD',
    // 1. Model so'rash
    (ctx) => { 
        ctx.reply('🚗 Mashina modelini kiriting:\n(Masalan: Gentra, Cobalt, Nexia 3)'); 
        ctx.wizard.state.data = {}; 
        return ctx.wizard.next(); 
    },
    // 2. Yil so'rash
    (ctx) => { 
        if (!ctx.message || !ctx.message.text) return ctx.reply('Iltimos, modelni matn ko\'rinishida yozing:');
        ctx.wizard.state.data.model = ctx.message.text; 
        ctx.reply('📅 Ishlab chiqarilgan yilini kiriting:'); 
        return ctx.wizard.next(); 
    },
    // 3. Yurganini so'rash
    (ctx) => { 
        if (!ctx.message || !ctx.message.text || isNaN(ctx.message.text)) return ctx.reply('Iltimos, yilni faqat raqamlarda kiriting:');
        ctx.wizard.state.data.year = ctx.message.text; 
        ctx.reply('🛣 Mashina qancha masofa yurgan? (KM da, faqat raqam):'); 
        return ctx.wizard.next(); 
    },
    // 4. Holati so'rovnomasi (Tugmalar)
    (ctx) => {
        if (!ctx.message || !ctx.message.text || isNaN(ctx.message.text)) return ctx.reply('Iltimos, yurgan masofasini faqat raqamda kiriting:');
        ctx.wizard.state.data.mileage = ctx.message.text; 
        
        ctx.reply('🛠 Mashina holatini tanlang:', {
            reply_markup: {
                inline_keyboard: [
                    [{ text: "✨ Toza (Kraska yo'q, urilmagan)", callback_data: "cond_toza" }],
                    [{ text: "🎨 Petno/Kraska bor (Urilmagan)", callback_data: "cond_kraska" }],
                    [{ text: "💥 Urilgan / Yorilgan joyi bor", callback_data: "cond_yorilgan" }]
                ]
            }
        });
        return ctx.wizard.next();
    },
    // 5. Avtoelon tahlili va Tel raqam so'rash
    async (ctx) => {
        if (!ctx.callbackQuery) return ctx.reply('Iltimos, yuqoridagi tugmalardan birini tanlang:');
        await ctx.answerCbQuery();
        
        let statusText = "";
        let condValue = "";
        if (ctx.callbackQuery.data === "cond_toza") { statusText = "Toza (Kraska yo'q)"; condValue = "toza"; }
        if (ctx.callbackQuery.data === "cond_kraska") { statusText = "Petno/Kraska bor"; condValue = "kraska_bor"; }
        if (ctx.callbackQuery.data === "cond_yorilgan") { statusText = "Urilgan / Yorilgan joyi bor"; condValue = "yorilgan_urilgan"; }
        
        ctx.wizard.state.data.condition_text = statusText;
        ctx.wizard.state.data.condition_val = condValue;

        await ctx.reply('⏳ Avtoelon.uz saytidan joriy narxlar tekshirilmoqda, iltimos kuting...');

        const d = ctx.wizard.state.data;
        let realPrice = await getRealAvtoelonPrice(d.model, d.year);
        
        if (!realPrice) {
            realPrice = calculateBackupPrice(d.model, d.year, d.condition_val);
        } else {
            // Avtoelon o'rtacha narxidan holatiga qarab chegirish
            if (d.condition_val === 'yorilgan_urilgan') realPrice -= 1400; // Yorilgan bo'lsa keskin tushadi
            else if (d.condition_val === 'kraska_bor') realPrice -= 450;
            
            const km = parseInt(d.mileage) || 0;
            realPrice -= Math.floor(km / 50000) * 150;
        }

        ctx.wizard.state.data.price = realPrice;

        ctx.reply(`📊 Avtoelon.uz tahliliga ko'ra moshina narxi taxminan: **${realPrice} $**\n\n📞 Telefon raqamingizni yuboring:`, { 
            reply_markup: { keyboard: [[{ text: "📱 Raqamni yuborish", request_contact: true }]], one_time_keyboard: true, resize_keyboard: true } 
        }); 
        return ctx.wizard.next(); 
    },
    // 6. Rasm so'rash
    async (ctx) => {
        const phone = ctx.message.contact ? ctx.message.contact.phone_number : (ctx.message ? ctx.message.text : null);
        if (!phone) return ctx.reply('Iltimos, raqamni yuboring:');
        ctx.wizard.state.data.phone = phone;
        ctx.reply('🖼 Mashina rasmini yuboring:', { reply_markup: { remove_keyboard: true } });
        return ctx.wizard.next();
    },
    // 7. Kanalga e'lonni chiqarish va yopish
    async (ctx) => {
        if (!ctx.message || !ctx.message.photo) return ctx.reply('Iltimos, mashina rasmini yuboring:');
        const photoId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
        const d = ctx.wizard.state.data;
        const elonNo = getNextOrderNumber();
        
        try {
            await ctx.telegram.sendPhoto(KANAL_ID, photoId, { 
                caption: `📣 **E'LON №${elonNo}**\n\n🚗 #SOTILADI\n\n🚙 Modeli: ${d.model}\n📅 Yili: ${d.year}-yil\n🛣 Yurgani: ${d.mileage} KM\n🛠 Holati: ${d.condition_text}\n💰 Baholangan narxi: **${d.price} $**\n📞 Tel: ${d.phone}` 
            });
            ctx.reply(`✅ E'loningiz Avtoelon.uz bazasi bo'yicha hisoblandi va kanalga joylashtirildi! (E'lon №${elonNo})`);
        } catch (err) {
            ctx.reply('Xatolik: Bot e\'lonni kanalga chiqara olmadi. Bot kanalda admin ekanligini tekshiring!');
        }
        return ctx.scene.leave();
    }
);

const stage = new Scenes.Stage([carAdWizard]);

// Sahnaning ichida turganda /start yoki /elon bosilsa seansni yangilash
stage.start(async (ctx) => { await ctx.scene.leave(); return ctx.reply('Salom! E\'lon berish uchun /elon buyrug\'ini bosing.'); });
stage.command('elon', async (ctx) => { await ctx.scene.leave(); return ctx.scene.enter('CAR_AD_WIZARD'); });

bot.use(stage.middleware());

// Global buyruqlar
bot.command('elon', (ctx) => ctx.scene.enter('CAR_AD_WIZARD'));
bot.start((ctx) => ctx.reply('Salom! E\'lon berish uchun /elon buyrug\'ini bosing.'));

// Port va tarmoq sozlamalari (Render uchun)
const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    bot.launch().then(() => console.log('Bot is live!')).catch((err) => console.error(err));
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
                             
