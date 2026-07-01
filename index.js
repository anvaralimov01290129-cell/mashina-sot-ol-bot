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

        if (queryModel.includes('nexia-3') || queryModel.includes('nexia3')) {
            queryModel = 'chevrolet/nexia-3';
        } else if (queryModel.includes('nexia-1') || queryModel.includes('nexia1') || (queryModel.includes('nexia') && !queryModel.includes('3') && !queryModel.includes('2'))) {
            queryModel = 'daewoo/nexia';
        } else if (queryModel.includes('nexia-2') || queryModel.includes('nexia2')) {
            queryModel = 'daewoo/nexia';
        } else if (queryModel.includes('gentra')) {
            queryModel = 'chevrolet/gentra';
        } else if (queryModel.includes('cobalt')) {
            queryModel = 'chevrolet/cobalt';
        } else if (queryModel.includes('spark')) {
            queryModel = 'chevrolet/spark';
        } else if (queryModel.includes('matiz')) {
            queryModel = 'daewoo/matiz';
        } else if (!queryModel.includes('/')) {
            queryModel = 'chevrolet/' + queryModel;
        }

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

// === ESKI MOShINALAR UChUN TO'G'RILANGAN ZAXIRA KALKULYATORI ===
function calculateBackupPrice(model, year, condition) {
    let price = 11000;
    const m = model.toLowerCase();
    const yr = parseInt(year) || 2010;

    if (m.includes('gentra') || m.includes('lacetti')) price = 13500;
    else if (m.includes('cobalt')) price = 12000;
    else if (m.includes('nexia 3')) price = 10500;
    else if (m.includes('spark')) price = 8000;
    else if (m.includes('nexia 2')) price = 5500;
    else if (m.includes('nexia 1') || m.includes('nexia')) price = 4200; 
    else if (m.includes('matiz')) price = 3500;
    else if (m.includes('damas')) price = 7000;
    else price = 6000;

    const currentYear = 2026;
    const diff = currentYear - yr;

    if (diff > 0) {
        if (m.includes('nexia 1') || m.includes('nexia') || m.includes('matiz') || yr < 2010) {
            price -= (diff * 130);
        } else {
            price -= (diff * 350);
        }
    }

    if (condition === 'yorilgan_urilgan') {
        price -= (m.includes('nexia 1') || m.includes('nexia') || m.includes('matiz')) ? 500 : 1300;
    } else if (condition === 'kraska_bor') {
        price -= (m.includes('nexia 1') || m.includes('nexia') || m.includes('matiz')) ? 250 : 450;
    }

    if (m.includes('nexia 1') || m.includes('nexia')) {
        if (price < 1100) price = 1100; 
        if (price > 2300 && yr < 2000) price = 1350; 
    } else if (m.includes('matiz')) {
        if (price < 1500) price = 1500;
    } else if (m.includes('nexia 2')) {
        if (price < 2800) price = 2800;
    } else if (m.includes('gentra') || m.includes('cobalt')) {
        if (price < 6500) price = 6500;
    }

    return Math.round(price);
}

app.get('/', (req, res) => res.send('Bot 24/7 ishlamoqda!'));
bot.use(session());

// === HUDUDLAR RO'YXATI ===
const regionsKeyboard = {
    reply_markup: {
        inline_keyboard: [
            [{ text: "🏙 Toshkent sh.", callback_data: "reg_Toshkent sh." }, { text: "🏔 Toshkent vil.", callback_data: "reg_Toshkent vil." }],
            [{ text: "🍇 Andijon", callback_data: "reg_Andijon" }, { text: "🕌 Buxoro", callback_data: "reg_Buxoro" }],
            [{ text: "☀️ Jizzax", callback_data: "reg_Jizzax" }, { text: "🍉 Xorazm", callback_data: "reg_Xorazm" }],
            [{ text: "🏭 Namangan", callback_data: "reg_Namangan" }, { text: "🏛 Navoiy", callback_data: "reg_Navoiy" }],
            [{ text: "🏺 Samarqand", callback_data: "reg_Samarqand" }, { text: "🏜 Sirdaryo", callback_data: "reg_Sirdaryo" }],
            [{ text: "🌴 Surxondaryo", callback_data: "reg_Surxondaryo" }, { text: "🦅 Farg'ona", callback_data: "reg_Farg'ona" }],
            [{ text: "🤠 Qashqadaryo", callback_data: "reg_Qashqadaryo" }, { text: "✨ Shahrisabz sh.", callback_data: "reg_Shahrisabz sh." }],
            [{ text: "⛺️ Qoraqalpog'iston", callback_data: "reg_Qoraqalpog'iston" }]
        ]
    }
};

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
    // 4. Holati so'rovnomasi
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
    // 5. Qaysi viloyatdan ekanligini so'rash (YANGI QO'ShILGAN BOSQICh)
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

        // Viloyatni so'raymiz
        await ctx.reply('📍 Qaysi hududdan / viloyatdansiz? Tanlang:', regionsKeyboard);
        return ctx.wizard.next();
    },
    // 6. Avtoelon tahlilini ko'rsatish va Sotuvchidan o'z narxini so'rash
    async (ctx) => {
        if (!ctx.callbackQuery || !ctx.callbackQuery.data.startsWith('reg_')) {
            return ctx.reply('Iltimos, hududlardan birini tugma orqali tanlang:');
        }
        await ctx.answerCbQuery();
        
        // Tanlangan viloyatni saqlaymiz
        const selectedRegion = ctx.callbackQuery.data.replace('reg_', '');
        ctx.wizard.state.data.region = selectedRegion;

        await ctx.reply('⏳ Avtoelon.uz bazasidan joriy bozor narxi tahlil qilinmoqda...');

        const d = ctx.wizard.state.data;
        let realPrice = await getRealAvtoelonPrice(d.model, d.year);
        
        if (!realPrice) {
            realPrice = calculateBackupPrice(d.model, d.year, d.condition_val);
        } else {
            if (d.condition_val === 'yorilgan_urilgan') realPrice -= 1400; 
            else if (d.condition_val === 'kraska_bor') realPrice -= 450;
            
            const km = parseInt(d.mileage) || 0;
            realPrice -= Math.floor(km / 50000) * 150;
        }

        if ((d.model.toLowerCase().includes('nexia 1') || d.model.toLowerCase() === 'nexia') && parseInt(d.year) < 2000 && realPrice > 2000) {
            realPrice = calculateBackupPrice(d.model, d.year, d.condition_val);
        }

        ctx.wizard.state.data.suggested_price = realPrice;

        await ctx.reply(`📊 Avtoelon.uz tahliliga ko'ra, moshinangizning o'rtacha bozor narxi: **${realPrice} $**\n\n💰 Siz moshinangizni necha pulga sotmoqchisiz?\n(Faqat raqam kiriting, masalan: 1350 yoki 12500)`);
        return ctx.wizard.next();
    },
    // 7. Sotuvchi kiritgan narxni qabul qilish va Tel raqam so'rash
    (ctx) => {
        if (!ctx.message || !ctx.message.text || isNaN(ctx.message.text)) {
            return ctx.reply('Iltimos, narxni faqat raqamlarda kiriting (Masalan: 4500):');
        }
        ctx.wizard.state.data.price = ctx.message.text; 

        ctx.reply('📞 Telefon raqamingizni yuboring:', { 
            reply_markup: { keyboard: [[{ text: "📱 Raqamni yuborish", request_contact: true }]], one_time_keyboard: true, resize_keyboard: true } 
        }); 
        return ctx.wizard.next();
    },
    // 8. Rasm so'rash
    async (ctx) => {
        const phone = ctx.message.contact ? ctx.message.contact.phone_number : (ctx.message ? ctx.message.text : null);
        if (!phone) return ctx.reply('Iltimos, raqamni yuboring:');
        ctx.wizard.state.data.phone = phone;
        ctx.reply('🖼 Mashina rasmini yuboring:', { reply_markup: { remove_keyboard: true } });
        return ctx.wizard.next();
    },
    // 9. Kanalga chiqarish
    async (ctx) => {
        if (!ctx.message || !ctx.message.photo) return ctx.reply('Iltimos, mashina rasmini yuboring:');
        const photoId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
        const d = ctx.wizard.state.data;
        const elonNo = getNextOrderNumber();
        
        try {
            await ctx.telegram.sendPhoto(KANAL_ID, photoId, { 
                caption: `📣 **E'LON №${elonNo}**\n\n🚗 #SOTILADI\n\n🚙 Modeli: ${d.model}\n📅 Yili: ${d.year}-yil\n🛣 Yurgani: ${d.mileage} KM\n🛠 Holati: ${d.condition_text}\n📍 Hudud: #__${d.region.replace(' ', '_')}__\n💰 Narxi: **${d.price} $**\n📊 Bozor narxi (Tavsiya): ${d.suggested_price} $\n📞 Tel: ${d.phone}` 
            });
            ctx.reply(`✅ E'loningiz ${d.region} hududi bo'yicha kanalga joylashtirildi! (E'lon №${elonNo})`);
        } catch (err) {
            ctx.reply('Xatolik: Bot e\'lonni kanalga chiqara olmadi.');
        }
        return ctx.scene.leave();
    }
);

const stage = new Scenes.Stage([carAdWizard]);
stage.start(async (ctx) => { await ctx.scene.leave(); return ctx.reply('Salom! E\'lon berish uchun /elon buyrug\'ini bosing.'); });
stage.command('elon', async (ctx) => { await ctx.scene.leave(); return ctx.scene.enter('CAR_AD_WIZARD'); });

bot.use(stage.middleware());
bot.command('elon', (ctx) => ctx.scene.enter('CAR_AD_WIZARD'));
bot.start((ctx) => ctx.reply('Salom! E\'lon berish uchun /elon buyrug\'ini bosing.'));

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    bot.launch().then(() => console.log('Bot is live!')).catch((err) => console.error(err));
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
                
