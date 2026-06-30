const { Telegraf, Scenes, session } = require('telegraf');
const LocalSession = require('telegraf-session-local');
const express = require('express');

// QUYIDAGI JOYGA O'Z MA'LUMOTLARINGIZNI YOZING:
const BOT_TOKEN = '8998326453:AAFN6OYcDOe_AU9YIKLAhzRI9GfA-u_t3to';
const KANAL_ID = '@mashinasotvasotibol';

const bot = new Telegraf(BOT_TOKEN);
const app = express();

app.get('/', (req, res) => res.send('Bot 24/7 ishlamoqda!'));
app.listen(process.env.PORT || 3000);

bot.use((new LocalSession({ database: 'session_db.json' })).middleware());

const carAdWizard = new Scenes.WizardScene('CAR_AD_WIZARD',
    (ctx) => { ctx.reply('🚗 Mashina modelini kiriting:'); ctx.wizard.state.data = {}; return ctx.wizard.next(); },
    (ctx) => { ctx.wizard.state.data.model = ctx.message.text; ctx.reply('📅 Yilini kiriting:'); return ctx.wizard.next(); },
    (ctx) => { ctx.wizard.state.data.year = ctx.message.text; ctx.reply('💰 Narxini kiriting:'); return ctx.wizard.next(); },
    (ctx) => { ctx.wizard.state.data.price = ctx.message.text; ctx.reply('📞 Telefon raqamingizni yuboring:', { reply_markup: { keyboard: [[{ text: "📱 Raqamni yuborish", request_contact: true }]], one_time_keyboard: true } }); return ctx.wizard.next(); },
    async (ctx) => {
        ctx.wizard.state.data.phone = ctx.message.contact ? ctx.message.contact.phone_number : ctx.message.text;
        ctx.reply('🖼 Mashina rasmini yuboring:');
        return ctx.wizard.next();
    },
    async (ctx) => {
        const photoId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
        const d = ctx.wizard.state.data;
        await ctx.telegram.sendPhoto(KANAL_ID, photoId, { caption: `🚗 Mashina: ${d.model}\n📅 Yil: ${d.year}\n💰 Narx: ${d.price}\n📞 Tel: ${d.phone}` });
        ctx.reply('✅ E\'lon kanalga joylandi!');
        return ctx.scene.leave();
    }
);

const stage = new Scenes.Stage([carAdWizard]);
bot.use(stage.middleware());
bot.command('elon', (ctx) => ctx.scene.enter('CAR_AD_WIZARD'));
bot.start((ctx) => ctx.reply('Salom! /elon buyrug\'i orqali e\'lon bering.'));
bot.launch();
