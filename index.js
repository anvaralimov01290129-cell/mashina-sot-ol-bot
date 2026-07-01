const { Telegraf, Scenes, session } = require('telegraf');
const express = require('express');
const fs = require('fs');
const path = require('path');

const BOT_TOKEN = '8998326453:AAH1JROgEtTuSGrFsrs4oZCwQylxULDlXwU';
const KANAL_ID = '@mashinasotvasotibol'; 

const bot = new Telegraf(BOT_TOKEN);
const app = express();

const COUNTER_FILE = path.join(__dirname, 'counter.json');

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

app.get('/', (req, res) => res.send('Bot 24/7 ishlamoqda!'));
bot.use(session());

// === AQLLI NARX HISOBLASH ALGORITMI ===
function calculateCarPrice(model, year, mileage, condition) {
    // Har bir model uchun boshlang'ich (salon/yangi) narxi
    let basePrice = 10000; 
    const m = model.toLowerCase();
    
    if (m.includes('nexia 3')) basePrice = 11500;
    else if (m.includes('gentra') || m.includes('lacetti')) basePrice = 14000;
    else if (m.includes('cobalt')) basePrice = 12500;
    else if (m.includes('spark')) basePrice = 9000;
    else if (m.includes('nexia 1') || m.includes('nexia 2')) basePrice = 6000;
    else if (m.includes('matiz')) basePrice = 4000;

    const currentYear = 2026;
    const age = currentYear - parseInt(year);
    
    // 1. Yili uchun narxni tushirish (har bir yil uchun 4% eskirish)
    if (age > 0) {
        basePrice = basePrice * Math.pow(0.96, age);
    }

    // 2. Yurgan masofasi (mileage) uchun narxni tushirish
    const km = parseInt(mileage) || 0;
    const mileageDeduction = (km / 10000) * 150; // Har 10,000 km uchun 150$ minus
    basePrice -= mileageDeduction;

    // 3. Kuzov holati bo'yicha narxni tushirish
    if (condition === 'yorilgan_urilgan') {
        basePrice = basePrice * 0.82; // 18% minus (yorilgan, urilgan, suyagi shikastlangan)
    } else if (condition === 'kraska_bor') {
        basePrice = basePrice * 0.93; // 7% minus (kraskasi bor, petno bor)
    }

    // Narx o'ta tushib ketsa, minimal chegara qo'yamiz
    if (basePrice < 1500) basePrice = 1500;

    return Math.round(basePrice);
}

const carAdWizard = new Scenes.WizardScene('CAR_AD_WIZARD',
    // 1-bosqich: Model
    (ctx) => { 
        ctx.reply('🚗 Mashina modelini kiriting:\n(Masalan: Nexia 3, Gentra, Cobalt)'); 
        ctx.wizard.state.data = {}; 
        return ctx.wizard.next(); 
    },
    // 2-bosqich: Yil
    (ctx) => { 
        if (!ctx.message || !ctx.message.text) return ctx.reply('Iltimos, modelni matn ko\'rinishida yozing:');
        ctx.wizard.state.data.model = ctx.message.text; 
        ctx.reply('📅 Ishlab chiqarilgan yilini kiriting:\n(Masalan: 2022)'); 
        return ctx.wizard.next(); 
    },
    // 3-bosqich: Yurgani (KM)
    (ctx) => { 
        if (!ctx.message || !ctx.message.text || isNaN(ctx.message.text)) return ctx.reply('Iltimos, yilni faqat raqamlarda kiriting (Masalan: 2022):');
        ctx.wizard.state.data.year = ctx.message.text; 
        ctx.reply('🛣 Mashina qancha masofa yurgan? (Faqat raqamda, KM):'); 
        return ctx.wizard.next(); 
    },
    // 4-bosqich: Holati (So'rovnoma)
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
    // 5-bosqich: Tel raqam
    async (ctx) => {
        if (!ctx.callbackQuery) return ctx.reply('Iltimos, tugmalardan birini tanlang:');
        await ctx.answerCbQuery();
        
        let statusText = "";
        let condValue = "";
        if (ctx.callbackQuery.data === "cond_toza") { statusText = "Toza (Kraska yo'q)"; condValue = "toza"; }
        if (ctx.callbackQuery.data === "cond_kraska") { statusText = "Petno/Kraska bor"; condValue = "kraska_bor"; }
        if (ctx.callbackQuery.data === "cond_yorilgan") { statusText = "Urilgan / Yorilgan joyi bor"; condValue = "yorilgan_urilgan"; }
        
        ctx.wizard.state.data.condition_text = statusText;
        ctx.wizard.state.data.condition_val = condValue;

        // Narxni hisoblash
        const d = ctx.wizard.state.data;
        const calculatedPrice = calculateCarPrice(d.model, d.year, d.mileage, d.condition_val);
        ctx.wizard.state.data.price = calculatedPrice;

        ctx.reply(`📊 Tizim moshina narxini taxminan **${calculatedPrice} $** deb hisobladi.\n\n📞 Telefon raqamingizni yuboring:`, { 
            reply_markup: { keyboard: [[{ text: "📱 Raqamni yuborish", request_contact: true }]], one_time_keyboard: true, resize_keyboard: true } 
        }); 
        return ctx.wizard.next(); 
    },
    // 6-bosqich: Rasm
    async (ctx) => {
        const phone = ctx.message.contact ? ctx.message.contact.phone_number : (ctx.message ? ctx.message.text : null);
        if (!phone) return ctx.reply('Iltimos, raqamni yuboring:');
        ctx.wizard.state.data.phone = phone;
        ctx.reply('🖼 Mashina rasmini yuboring:', { reply_markup: { remove_keyboard: true } });
        return ctx.wizard.next();
    },
    // 7-bosqich: Kanalga chiqarish
    async (ctx) => {
        if (!ctx.message || !ctx.message.photo) return ctx.reply('Iltimos, mashina rasmini yuboring:');
        const photoId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
        const d = ctx.wizard.state.data;
        const elonNo = getNextOrderNumber();
        
        try {
            await ctx.telegram.sendPhoto(KANAL_ID, photoId, { 
                caption: `📣 **E'LON №${elonNo}**\n\n🚗 #SOTILADI\n\n🚙 Modeli: ${d.model}\n📅 Yili: ${d.year}\n🛣 Yurgani: ${d.mileage} KM\n🛠 Holati: ${d.condition_text}\n💰 Hisoblangan narxi: **${d.price} $**\n📞 Tel: ${d.phone}` 
            });
            ctx.reply(`✅ E'loningiz hisoblandi va kanalga joylashtirildi! (E'lon №${elonNo})`);
        } catch (err) {
            ctx.reply('Xatolik: Bot kanalga xabar joylay olmadi. Bot kanalda admin ekanini tekshiring!');
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
        
