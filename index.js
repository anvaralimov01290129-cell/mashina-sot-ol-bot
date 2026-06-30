const { Telegraf, Scenes, session } = require('telegraf');
const LocalSession = require('telegraf-session-local');
const express = require('express');

// Tokeningiz va Kanal ID-ngiz joylashtirildi:
const BOT_TOKEN = '8998326453:AAEJW-jLx24cG6CfvWqUvjvW0hgjEPbZSNs';
const KANAL_ID = '@mashinasotvasotibol'; 

const bot = new Telegraf(BOT_TOKEN);
const app = express();

app.get('/', (req, res) => res.send('Bot 24/7 ishlamoqda!'));
app.listen(process.env.PORT || 3000);

bot.use((new LocalSession({ database: 'session_db.json' })).middleware());

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
        await ctx.telegram.sendPhoto(KANAL_ID, photoId, { caption: `🚗 #SOTILADI\n\n🚙 Modeli: ${d.model}\n📅 Yili: ${d.year}\n💰 Narxi: ${d.price}\n📞 Tel: ${d.phone}\n\n🤖 @${ctx.botInfo.username} orqali joylandi.` });
        ctx.reply('✅ E\'loningiz muvaffaqiyatli kanalga joylashtirildi!');
        return ctx.scene.leave();
    }
);

const stage = new Scenes.Stage([carAdWizard]);
bot.use(stage.middleware());
bot.command('elon', (ctx) => ctx.scene.enter('CAR_AD_WIZARD'));
bot.start((ctx) => ctx.reply('Salom! E\'lon berish uchun /elon buyrug\'ini bosing.'));
bot.launch();
                  
