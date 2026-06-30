const { Telegraf, Scenes, session } = require('telegraf');
const express = require('express');

// Yangi xavfsiz tokeningiz joylashtirildi:
const BOT_TOKEN = '8998326453:AAH1JROgEtTuSGrFsrs4oZCwQylxULDlXwU';
const KANAL_ID = '@mashinasotvasotibol'; 

const bot = new Telegraf(BOT_TOKEN);
const app = express();

app.get('/', (req, res) => res.send('Bot 24/7 ishlamoqda!'));

// Tezkor xotiradan seanslar uchun foydalanamiz
bot.use(session());

const carAdWizard = new Scenes.WizardScene('CAR_AD_WIZARD',
    (ctx) => { 
        ctx.reply('🚗 Mashina modelini kiriting:'); 
        ctx.wizard.state.data = {}; 
        return ctx.wizard.next(); 
    },
    (ctx) => { 
        if (!ctx.message || !ctx.message.text) return ctx.reply('Iltimos, modelni matn ko\'rinishida yozing:');
        ctx.wizard.state.data.model = ctx.message.text; 
        ctx.reply('📅 Yilini kiriting:'); 
        return ctx.wizard.next(); 
    },
    (ctx) => { 
        if (!ctx.message || !ctx.message.text) return ctx.reply('Iltimos, yilni kiriting:');
        ctx.wizard.state.data.year = ctx.message.text; 
        ctx.reply('💰 Narxini kiriting:'); 
        return ctx.wizard.next(); 
    },
    (ctx) => { 
        if (!ctx.message || !ctx.message.text) return ctx.reply('Iltimos, narxni kiriting:');
        ctx.wizard.state.data.price = ctx.message.text; 
        ctx.reply('📞 Telefon raqamingizni yuboring:', { reply_markup: { keyboard: [[{ text: "📱 Raqamni yuborish", request_contact: true }]], one_time_keyboard: true, resize_keyboard: true } }); 
        return ctx.wizard.next(); 
    },
    async (ctx) => {
        const phone = ctx.message.contact ? ctx.message.contact.phone_number : (ctx.message ? ctx.message.text : null);
        if (!phone) return ctx.reply('Iltimos, raqamni yuboring:');
        ctx.wizard.state.data.phone = phone;
        ctx.reply('🖼 Mashina rasmini yuboring:', { reply_markup: { remove_keyboard: true } });
        return ctx.wizard.next();
    },
    async (ctx) => {
        if (!ctx.message || !ctx.message.photo) return ctx.reply('Iltimos, mashina rasmini yuboring:');
        const photoId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
        const d = ctx.wizard.state.data;
        try {
            await ctx.telegram.sendPhoto(KANAL_ID, photoId, { caption: `🚗 #SOTILADI\n\n🚙 Modeli: ${d.model}\n📅 Yili: ${d.year}\n💰 Narxi: ${d.price}\n📞 Tel: ${d.phone}` });
            ctx.reply('✅ E\'loningiz muvaffaqiyatli kanalga joylashtirildi!');
        } catch (err) {
            ctx.reply('Xatolik: Bot kanalga e\'lon joylay olmadi. Bot kanalingizda ADMIN ekanligini va xabar joylash ruxsati borligini qayta tekshiring!');
        }
        return ctx.scene.leave();
    }
);

const stage = new Scenes.Stage([carAdWizard]);
bot.use(stage.middleware());

bot.command('elon', (ctx) => ctx.scene.enter('CAR_AD_WIZARD'));
bot.start((ctx) => ctx.reply('Salom! E\'lon berish uchun /elon buyrug\'ini bosing.'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    bot.launch()
        .then(() => console.log('Bot is live!'))
        .catch((err) => console.error('Bot launch error:', err));
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
