const { Telegraf } = require('telegraf');
const express = require('express');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');

const BOT_TOKEN = '8998326453:AAH1JROgEtTuSGrFsrs4oZCwQylxULDlXwU';
const KANAL_ID = '@mashinasotvasotibol'; 

const bot = new Telegraf(BOT_TOKEN);
const app = express();

const COUNTER_FILE = path.join(__dirname, 'counter.json');
const ADS_FILE = path.join(__dirname, 'ads.json');
const STATES_FILE = path.join(__dirname, 'states.json');

// Ma'lumotlarni faylda saqlash (Server restart bo'lsa ham o'chib ketmaydi)
function readJSON(file, defaultVal = []) {
    try { if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { console.error(e); }
    return defaultVal;
}

function writeJSON(file, data) {
    try { fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8'); } catch (e) { console.error(e); }
}

function getNextOrderNumber() {
    let counter = readJSON(COUNTER_FILE, { count: 0 });
    counter.count++;
    writeJSON(COUNTER_FILE, counter);
    return counter.count;
}

// Foydalanuvchi qadamlarini boshqarish uchun obyekt
let userStates = readJSON(STATES_FILE, {});

function setUserState(userId, step, data = {}) {
    if (!userStates[userId]) userStates[userId] = { step: 'IDLE', data: {} };
    if (step) userStates[userId].step = step;
    userStates[userId].data = { ...userStates[userId].data, ...data };
    writeJSON(STATES_FILE, userStates);
}

function clearUserState(userId) {
    delete userStates[userId];
    writeJSON(STATES_FILE, userStates);
}

async function getRealAvtoelonPrice(model, year) {
    try {
        let queryModel = model.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        let isUzAuto = false;

        if (queryModel.includes('nexia-3') || queryModel.includes('nexia3')) { queryModel = 'chevrolet/nexia-3'; isUzAuto = true; }
        else if (queryModel.includes('nexia-1') || queryModel.includes('nexia1') || (queryModel.includes('nexia') && !queryModel.includes('3') && !queryModel.includes('2'))) { queryModel = 'daewoo/nexia'; isUzAuto = true; }
        else if (queryModel.includes('nexia-2') || queryModel.includes('nexia2')) { queryModel = 'daewoo/nexia'; isUzAuto = true; }
        else if (queryModel.includes('gentra')) { queryModel = 'chevrolet/gentra'; isUzAuto = true; }
        else if (queryModel.includes('cobalt')) { queryModel = 'chevrolet/cobalt'; isUzAuto = true; }
        else if (queryModel.includes('spark')) { queryModel = 'chevrolet/spark'; isUzAuto = true; }
        else if (queryModel.includes('matiz')) { queryModel = 'daewoo/matiz'; isUzAuto = true; }
        else if (queryModel.includes('damas')) { queryModel = 'chevrolet/damas'; isUzAuto = true; }
        else if (queryModel.includes('lacetti')) { queryModel = 'chevrolet/lacetti'; isUzAuto = true; }

        if (!isUzAuto) return null;

        const url = `https://avtoelon.uz/uz/avto/${queryModel}/year-${year}/`;
        const response = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const $ = cheerio.load(response.data);
        let prices = [];

        $('.price').each((i, elem) => {
            let priceText = $(elem).text().replace(/[^0-9]/g, ''); 
            let priceNum = parseInt(priceText);
            if (priceNum > 2000 && priceNum < 100000) prices.push(priceNum);
        });

        if (prices.length > 0) return Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
    } catch (error) { console.error("Avtoelon xatosi:", error.message); }
    return null; 
}

function calculateBackupPrice(model, year, condition) {
    let price = 0; const m = model.toLowerCase(); const yr = parseInt(year) || 2010;
    if (m.includes('gentra') || m.includes('lacetti')) price = 13500;
    else if (m.includes('cobalt')) price = 12000;
    else if (m.includes('nexia 3')) price = 10500;
    else if (m.includes('spark')) price = 8000;
    else if (m.includes('nexia 2')) price = 5500;
    else if (m.includes('nexia 1') || m.includes('nexia')) price = 4200; 
    else if (m.includes('matiz')) price = 3500;
    else if (m.includes('damas')) price = 7000;
    else return null;

    const currentYear = 2026; const diff = currentYear - yr;
    if (diff > 0) {
        if (m.includes('nexia 1') || m.includes('nexia') || m.includes('matiz') || yr < 2010) price -= (diff * 130);
        else price -= (diff * 350);
    }
    if (condition === 'yorilgan_urilgan') price -= 1000;
    else if (condition === 'kraska_bor') price -= 400;

    return Math.round(price > 1000 ? price : 1100);
}

app.get('/', (req, res) => res.send('Bot 24/7 faol ishlamoqda!'));

const mainMenu = {
    reply_markup: {
        keyboard: [[{ text: "🚗 E'lon berish" }, { text: "📦 Mening e'lonlarim" }]],
        resize_keyboard: true
    }
};

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

// Start va Asosiy tugmalar xizmati
bot.start((ctx) => {
    clearUserState(ctx.from.id);
    return ctx.reply('Salom! Moshina bozor botimizga xush kelibsiz. Quyidagi menudan foydalaning:', mainMenu);
});

bot.hears("🚗 E'lon berish", (ctx) => {
    setUserState(ctx.from.id, 'WAITING_MODEL', {});
    return ctx.reply('🚗 Mashina markasi va modelini kiriting:\n(Masalan: Cobalt, Kia K5, Nexia 3)', { reply_markup: { remove_keyboard: true } });
});

bot.hears("📦 Mening e'lonlarim", (ctx) => {
    clearUserState(ctx.from.id);
    const ads = readJSON(ADS_FILE).filter(a => a.userId === ctx.from.id);
    if (ads.length === 0) return ctx.reply('🔍 Sizda hozircha hech qanday e\'lon yo\'q.');

    ctx.reply(`🗂 Sizning jami e'lonlaringiz soni: ${ads.length} ta.`);

    ads.forEach(ad => {
        let statusEmoji = ad.status === 'active' ? '🟢 Faol' : '🔴 Sotilgan';
        ctx.replyWithPhoto(ad.photoId, {
            caption: `**E'LON №${ad.elonNo}**\n🚗 Moshina: ${ad.model}\n💰 Narxi: ${ad.price} $\n📌 Holati: ${statusEmoji}`,
            reply_markup: {
                inline_keyboard: ad.status === 'active' ? [
                    [{ text: "💰 Sotildi", callback_data: `sol_${ad.elonNo}` }, { text: "❌ O'chirish", callback_data: `del_${ad.elonNo}` }]
                ] : [[{ text: "❌ O'chirish", callback_data: `del_${ad.elonNo}` }]]
            }
        });
    });
});

// Xabarlarni qadam bo'yicha qayta ishlash matni (Asosiy logika)
bot.on('message', async (ctx, next) => {
    const userId = ctx.from.id;
    const state = userStates[userId];

    if (!state || state.step === 'IDLE') return next();

    // 1-QADAM: Model qabul qilish
    if (state.step === 'WAITING_MODEL') {
        if (!ctx.message.text) return ctx.reply('Iltimos, modelni matnda yozing:');
        setUserState(userId, 'WAITING_YEAR', { model: ctx.message.text });
        return ctx.reply('📅 Ishlab chiqarilgan yilini kiriting:');
    }

    // 2-QADAM: Yil qabul qilish
    if (state.step === 'WAITING_YEAR') {
        if (!ctx.message.text || isNaN(ctx.message.text)) return ctx.reply('Iltimos, yilni faqat raqamda kiriting:');
        setUserState(userId, 'WAITING_MILEAGE', { year: ctx.message.text });
        return ctx.reply('🛣 Mashina qancha masofa yurgan? (KM da, faqat raqam):');
    }

    // 3-QADAM: Yurgan yo'li
    if (state.step === 'WAITING_MILEAGE') {
        if (!ctx.message.text || isNaN(ctx.message.text)) return ctx.reply('Iltimos, masofani faqat raqamda kiriting:');
        setUserState(userId, 'WAITING_CONDITION', { mileage: ctx.message.text });
        return ctx.reply('🛠 Mashina holatini tanlang:', {
            reply_markup: {
                inline_keyboard: [
                    [{ text: "✨ Toza (Kraska yo'q)", callback_data: "cond_toza" }],
                    [{ text: "🎨 Petno/Kraska bor", callback_data: "cond_kraska" }],
                    [{ text: "💥 Urilgan / Yorilgan", callback_data: "cond_yorilgan" }]
                ]
            }
        });
    }

    // 4-QADAM: Narx kiritish
    if (state.step === 'WAITING_PRICE') {
        if (!ctx.message.text) return ctx.reply('Iltimos, narxni yozing:');
        setUserState(userId, 'WAITING_PHONE', { price: ctx.message.text });
        return ctx.reply('📞 Telefon raqamingizni yuboring:', { 
            reply_markup: { keyboard: [[{ text: "📱 Raqamni yuborish", request_contact: true }]], one_time_keyboard: true, resize_keyboard: true } 
        });
    }

    // 5-QADAM: Telefon raqam kiritish
    if (state.step === 'WAITING_PHONE') {
        const phone = ctx.message.contact ? ctx.message.contact.phone_number : ctx.message.text;
        if (!phone) return ctx.reply('Iltimos, telefon raqamingizni yuboring:');
        setUserState(userId, 'WAITING_PHOTO', { phone: phone });
        return ctx.reply('🖼 Mashina rasmini yuboring:', { reply_markup: { remove_keyboard: true } });
    }

    // 6-QADAM: Rasm qabul qilish va Kanalga chiqarish
    if (state.step === 'WAITING_PHOTO') {
        if (!ctx.message.photo) return ctx.reply('Iltimos, mashina rasmini fayl emas, rasm shaklida yuboring:');
        const photoId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
        
        const d = state.data;
        const elonNo = getNextOrderNumber();
        
        let captionText = `📣 **E'LON №${elonNo}**\n\n🚗 #SOTILADI\n\n🚙 Modeli: ${d.model}\n📅 Yili: ${d.year}-yil\n🛣 Yurgani: ${d.mileage} KM\n🛠 Holati: ${d.condition_text}\n📍 Hudud: #__${d.region.replace(' ', '_')}__\n💰 Narxi: **${d.price} $**\n`;
        if (d.suggested_price !== "Noaniq") captionText += `📊 Bozor narxi (Tavsiya): ${d.suggested_price}\n`;
        captionText += `📞 Tel: ${d.phone}`;
        
        try {
            const channelMsg = await ctx.telegram.sendPhoto(KANAL_ID, photoId, { caption: captionText });
            
            let ads = readJSON(ADS_FILE);
            ads.push({
                userId: userId,
                elonNo: elonNo,
                model: d.model,
                price: d.price,
                photoId: photoId,
                channelMsgId: channelMsg.message_id,
                caption: captionText,
                status: 'active'
            });
            writeJSON(ADS_FILE, ads);

            ctx.reply(`✅ E'loningiz kanalga muvaffaqiyatli joylashtirildi! (E'lon №${elonNo})`, mainMenu);
            clearUserState(userId);
        } catch (err) {
            ctx.reply('Xatolik: Bot e\'lonni kanalga chiqara olmadi. Bot kanalizda admin ekanligini tekshiring.', mainMenu);
            clearUserState(userId);
        }
    }
});

// Inline tugmalar bosilganda (Callback Query)
bot.on('callback_query', async (ctx) => {
    const data = ctx.callbackQuery.data;
    const userId = ctx.from.id;
    await ctx.answerCbQuery();

    // Holatni tanlash qadami
    if (data.startsWith('cond_')) {
        const state = userStates[userId];
        if (!state || state.step !== 'WAITING_CONDITION') return;

        let statusText = ""; let condValue = "";
        if (data === "cond_toza") { statusText = "Toza (Kraska yo'q)"; condValue = "toza"; }
        if (data === "cond_kraska") { statusText = "Petno/Kraska bor"; condValue = "kraska_bor"; }
        if (data === "cond_yorilgan") { statusText = "Urilgan / Yorilgan joyi bor"; condValue = "yorilgan_urilgan"; }

        setUserState(userId, 'WAITING_REGION', { condition_text: statusText, condition_val: condValue });
        return ctx.reply('📍 Qaysi hududdan / viloyatdansiz? Tanlang:', regionsKeyboard);
    }

    // Hududni tanlash qadami
    if (data.startsWith('reg_')) {
        const state = userStates[userId];
        if (!state || state.step !== 'WAITING_REGION') return;

        const region = data.replace('reg_', '');
        const d = state.data;

        await ctx.reply('⏳ Bozor narxi tahlil qilinmoqda...');
        let realPrice = await getRealAvtoelonPrice(d.model, d.year);
        
        if (!realPrice) {
            realPrice = calculateBackupPrice(d.model, d.year, state.data.condition_val);
        } else {
            if (state.data.condition_val === 'yorilgan_urilgan') realPrice -= 1400; 
            else if (state.data.condition_val === 'kraska_bor') realPrice -= 450;
            realPrice -= Math.floor((parseInt(d.mileage) || 0) / 50000) * 150;
        }

        let sugPriceText = "Noaniq";
        if (realPrice) { sugPriceText = `${realPrice} $`; }

        setUserState(userId, 'WAITING_PRICE', { region: region, suggested_price: sugPriceText });

        if (realPrice) {
            await ctx.reply(`📊 O'rtacha bozor narxi: **${realPrice} $**\n\n💰 Siz necha pulga sotmoqchisiz?\n(Masalan: 4500)`);
        } else {
            await ctx.reply(`✨ Ushbu model uchun avtomatik narx hisoblanmadi.\n\n💰 Moshinangiz narxini kiriting (faqat raqamda):`);
        }
        return;
    }

    // E'lonni sotildi qilish yoki o'chirish
    if (data.startsWith('sol_') || data.startsWith('del_')) {
        let ads = readJSON(ADS_FILE);
        const elonNo = data.split('_')[1];
        const index = ads.findIndex(a => a.elonNo == elonNo && a.userId === userId);

        if (index !== -1) {
            const ad = ads[index];
            if (data.startsWith('sol_')) {
                ads[index].status = 'sold';
                writeJSON(ADS_FILE, ads);
                try {
                    await ctx.telegram.editMessageCaption(KANAL_ID, ad.channelMsgId, null, `🔥 **MOSHINA SOTILDI!**\n\n🤝 Barakasini bersin!\n\n${ad.caption}\n\n#SOTILDI`);
                    ctx.reply(`🎉 E'lon №${elonNo} "SOTILDI" holatiga o'tkazildi!`);
                } catch (e) { ctx.reply(`👍 Botda sotildi deb belgilandi!`); }
            } else if (data.startsWith('del_')) {
                ads.splice(index, 1);
                writeJSON(ADS_FILE, ads);
                try {
                    await ctx.telegram.deleteMessage(KANAL_ID, ad.channelMsgId);
                    ctx.reply(`🗑 E'lon №${elonNo} o'chirildi.`);
                } catch (e) { ctx.reply(`🗑 Botdan o'chirildi.`); }
            }
        }
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    bot.launch();
});
    
