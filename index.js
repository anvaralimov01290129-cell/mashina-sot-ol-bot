const { Telegraf, Scenes, session } = require('telegraf');
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
    } catch (err) { return Math.floor(Math.random() * 1000); }
}

function readAds() {
    try { if (fs.existsSync(ADS_FILE)) return JSON.parse(fs.readFileSync(ADS_FILE, 'utf8')); } catch (e) { console.error(e); }
    return [];
}

function saveAd(ad) {
    const ads = readAds();
    ads.push(ad);
    fs.writeFileSync(ADS_FILE, JSON.stringify(ads, null, 2), 'utf8');
}

// Global obyekt - agar session o'chib ketsa ham ma'lumotlar yo'qolmasligi uchun zaxira
const userStates = {};

function updateAdStatus(elonNo, status) {
    let ads = readAds();
    const index = ads.findIndex(a => a.elonNo == elonNo);
    if (index !== -1) {
        if (status === 'deleted') { ads.splice(index, 1); } 
        else { ads[index].status = status; }
        fs.writeFileSync(ADS_FILE, JSON.stringify(ads, null, 2), 'utf8');
        return true;
    }
    return false;
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

app.get('/', (req, res) => res.send('Bot 24/7 ishlamoqda!'));

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

const carAdWizard = new Scenes.WizardScene('CAR_AD_WIZARD',
    (ctx) => { 
        ctx.reply('🚗 Mashina markasi va modelini kiriting:\n(Masalan: Cobalt, Kia K5, Nexia 3)', { reply_markup: { remove_keyboard: true } }); 
        ctx.wizard.state.data = {}; 
        userStates[ctx.from.id] = {};
        return ctx.wizard.next(); 
    },
    (ctx) => { 
        if (!ctx.message || !ctx.message.text) return ctx.reply('Iltimos, modelni matnda yozing:');
        ctx.wizard.state.data.model = ctx.message.text; 
        userStates[ctx.from.id].model = ctx.message.text;
        ctx.reply('📅 Ishlab chiqarilgan yilini kiriting:'); 
        return ctx.wizard.next(); 
    },
    (ctx) => { 
        if (!ctx.message || !ctx.message.text || isNaN(ctx.message.text)) return ctx.reply('Iltimos, yilni raqamda kiriting:');
        ctx.wizard.state.data.year = ctx.message.text; 
        userStates[ctx.from.id].year = ctx.message.text;
        ctx.reply('🛣 Mashina qancha masofa yurgan? (KM da, faqat raqam):'); 
        return ctx.wizard.next(); 
    },
    (ctx) => { 
        if (!ctx.message || !ctx.message.text || isNaN(ctx.message.text)) return ctx.reply('Iltimos, masofani raqamda kiriting:');
        ctx.wizard.state.data.mileage = ctx.message.text; 
        userStates[ctx.from.id].mileage = ctx.message.text;
        
        ctx.reply('🛠 Mashina holatini tanlang:', {
            reply_markup: {
                inline_keyboard: [
                    [{ text: "✨ Toza (Kraska yo'q)", callback_data: "cond_toza" }],
                    [{ text: "🎨 Petno/Kraska bor", callback_data: "cond_kraska" }],
                    [{ text: "💥 Urilgan / Yorilgan", callback_data: "cond_yorilgan" }]
                ]
            }
        });
        return ctx.wizard.next();
    },
    async (ctx) => {
        if (!ctx.callbackQuery) return ctx.reply('Iltimos, tugmalardan birini tanlang:');
        await ctx.answerCbQuery();
        
        let statusText = ""; let condValue = "";
        if (ctx.callbackQuery.data === "cond_toza") { statusText = "Toza (Kraska yo'q)"; condValue = "toza"; }
        if (ctx.callbackQuery.data === "cond_kraska") { statusText = "Petno/Kraska bor"; condValue = "kraska_bor"; }
        if (ctx.callbackQuery.data === "cond_yorilgan") { statusText = "Urilgan / Yorilgan joyi bor"; condValue = "yorilgan_urilgan"; }
        
        ctx.wizard.state.data.condition_text = statusText;
        ctx.wizard.state.data.condition_val = condValue;
        userStates[ctx.from.id].condition_text = statusText;
        userStates[ctx.from.id].condition_val = condValue;

        await ctx.reply('📍 Qaysi hududdan / viloyatdansiz? Tanlang:', regionsKeyboard);
        return ctx.wizard.next();
    },
    async (ctx) => {
        if (!ctx.callbackQuery || !ctx.callbackQuery.data.startsWith('reg_')) return ctx.reply('Iltimos, hududni tugma orqali tanlang:');
        await ctx.answerCbQuery();
        
        const region = ctx.callbackQuery.data.replace('reg_', '');
        ctx.wizard.state.data.region = region;
        userStates[ctx.from.id].region = region;
        
        const d = ctx.wizard.state.data.model ? ctx.wizard.state.data : userStates[ctx.from.id];
        
        await ctx.reply('⏳ Bozor narxi tahlil qilinmoqda...');
        let realPrice = await getRealAvtoelonPrice(d.model, d.year);
        if (!realPrice) {
            realPrice = calculateBackupPrice(d.model, d.year, d.condition_val);
        } else {
            if (d.condition_val === 'yorilgan_urilgan') realPrice -= 1400; 
            else if (d.condition_val === 'kraska_bor') realPrice -= 450;
            realPrice -= Math.floor((parseInt(d.mileage) || 0) / 50000) * 150;
        }

        if (d.model.toLowerCase().includes('nexia 1') && parseInt(d.year) < 2000 && realPrice > 2000) {
            realPrice = calculateBackupPrice(d.model, d.year, d.condition_val);
        }

        if (realPrice) {
            ctx.wizard.state.data.suggested_price = `${realPrice} $`;
            userStates[ctx.from.id].suggested_price = `${realPrice} $`;
            await ctx.reply(`📊 O'rtacha bozor narxi: **${realPrice} $**\n\n💰 Siz necha pulga sotmoqchisiz?\n(Masalan: 4500)`);
        } else {
            ctx.wizard.state.data.suggested_price = "Noaniq (Evro/Xorijiy avto)";
            userStates[ctx.from.id].suggested_price = "Noaniq (Evro/Xorijiy avto)";
            await ctx.reply(`✨ Xorijiy/Evro moshinalar uchun avtomatik narx hisoblanmaydi.\n\n💰 Moshinangiz narxini kiriting (faqat raqamda):`);
        }
        return ctx.wizard.next();
    },
    (ctx) => {
        if (!ctx.message || !ctx.message.text) return ctx.reply('Iltimos, narxni kiriting:');
        ctx.wizard.state.data.price = ctx.message.text; 
        userStates[ctx.from.id].price = ctx.message.text;

        ctx.reply('📞 Telefon raqamingizni yuboring:', { 
            reply_markup: { keyboard: [[{ text: "📱 Raqamni yuborish", request_contact: true }]], one_time_keyboard: true, resize_keyboard: true } 
        }); 
        return ctx.wizard.next();
    },
    async (ctx) => {
        const phone = ctx.message.contact ? ctx.message.contact.phone_number : (ctx.message ? ctx.message.text : null);
        if (!phone) return ctx.reply('Iltimos, raqamni yuboring:');
        ctx.wizard.state.data.phone = phone;
        userStates[ctx.from.id].phone = phone;
        ctx.reply('🖼 Mashina rasmini yuboring:', { reply_markup: { remove_keyboard: true } });
        return ctx.wizard.next();
    },
    async (ctx) => {
        if (!ctx.message || !ctx.message.photo) return ctx.reply('Iltimos, mashina rasmini yuboring:');
        const photoId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
        
        const d = ctx.wizard.state.data.model ? ctx.wizard.state.data : userStates[ctx.from.id];
        const elonNo = getNextOrderNumber();
        
        let captionText = `📣 **E'LON №${elonNo}**\n\n🚗 #SOTILADI\n\n🚙 Modeli: ${d.model}\n📅 Yili: ${d.year}-yil\n🛣 Yurgani: ${d.mileage} KM\n🛠 Holati: ${d.condition_text}\n📍 Hudud: #__${d.region.replace(' ', '_')}__\n💰 Narxi: **${d.price} $**\n`;
        if (d.suggested_price !== "Noaniq (Evro/Xorijiy avto)") captionText += `📊 Bozor narxi (Tavsiya): ${d.suggested_price}\n`;
        captionText += `📞 Tel: ${d.phone}`;
        
        try {
            const channelMsg = await ctx.telegram.sendPhoto(KANAL_ID, photoId, { caption: captionText });
            
            saveAd({
                userId: ctx.from.id,
                elonNo: elonNo,
                model: d.model,
                price: d.price,
                photoId: photoId,
                channelMsgId: channelMsg.message_id,
                caption: captionText,
                status: 'active'
            });

            ctx.reply(`✅ E'loningiz kanalga joylashtirildi! (E'lon №${elonNo})`, mainMenu);
            delete userStates[ctx.from.id];
        } catch (err) {
            ctx.reply('Xatolik: Bot e\'lonni kanalga chiqara olmadi.', mainMenu);
        }
        return ctx.scene.leave();
    }
);

const stage = new Scenes.Stage([carAdWizard]);
bot.use(session());
bot.use(stage.middleware());

bot.hears("🚗 E'lon berish", (ctx) => {
    ctx.scene.leave();
    return ctx.scene.enter('CAR_AD_WIZARD');
});

bot.hears("📦 Mening e'lonlarim", (ctx) => {
    ctx.scene.leave();
    const ads = readAds().filter(a => a.userId === ctx.from.id);
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

bot.on('callback_query', async (ctx) => {
    const data = ctx.callbackQuery.data;
    await ctx.answerCbQuery();

    if (data.startsWith('sol_')) {
        const elonNo = data.replace('sol_', '');
        const ads = readAds();
        const ad = ads.find(a => a.elonNo == elonNo && a.userId === ctx.from.id);

        if (ad) {
            updateAdStatus(elonNo, 'sold');
            try {
                await ctx.telegram.editMessageCaption(KANAL_ID, ad.channelMsgId, null, `🔥 **MAShINA SOTILDI!**\n\n🤝 Barakasini bersin!\n\n${ad.caption}\n\n#SOTILDI`);
                ctx.reply(`🎉 E'lon №${elonNo} "SOTILDI" holatiga o'tkazildi!`);
            } catch (e) { ctx.reply(`👍 Botda belgilandi, kanaldagi eski xabarni tahrirlab bo'lmadi.`); }
        }
    }

    if (data.startsWith('del_')) {
        const elonNo = data.replace('del_', '');
        const ads = readAds();
        const ad = ads.find(a => a.elonNo == elonNo && a.userId === ctx.from.id);

        if (ad) {
            updateAdStatus(elonNo, 'deleted');
            try {
                await ctx.telegram.deleteMessage(KANAL_ID, ad.channelMsgId);
                ctx.reply(`🗑 E'lon №${elonNo} o'chirildi.`);
            } catch (e) { ctx.reply(`🗑 Botdan o'chirildi, kanaldan o'chirishda xatolik (balki e'lon juda eski).`); }
        }
    }
});

bot.command('elon', (ctx) => ctx.scene.enter('CAR_AD_WIZARD'));
bot.start((ctx) => ctx.reply('Salom! Moshina bozor botimizga xush kelibsiz. Quyidagi menudan foydalaning:', mainMenu));

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    bot.launch();
});
    
