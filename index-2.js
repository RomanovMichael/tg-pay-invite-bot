const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

// Конфигурация
const TELEGRAM_BOT_TOKEN = '7597119999:AAEg3uDHxQt1mURsuwMoLKdkAvsDlFupzaM'; // Токен бота
const SHOP_ID = 'your_shop_id'; // ID магазина в ЮKassa
const API_KEY = 'your_api_key'; // Секретный ключ API ЮKassa
const CHANNEL_ID = '@your_channel_username'; // Username или числовой ID канала

// Инициализация бота
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

// Функция для создания платежа через ЮKassa
async function createPayment(chatId, amount, description) {
    const url = 'https://api.yookassa.ru/v3/payments';
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(`${SHOP_ID}:${API_KEY}`).toString('base64')}`
    };
    const payload = {
        amount: {
            value: amount,
            currency: "RUB"
        },
        confirmation: {
            type: "redirect",
            return_url: "https://t.me/your_bot_username" // URL для редиректа после оплаты
        },
        description: description,
        metadata: {
            chat_id: chatId // Сохраняем chatId для идентификации пользователя
        }
    };

    try {
        const response = await axios.post(url, payload, { headers });
        return response.data;
    } catch (error) {
        console.error('Ошибка при создании платежа:', error.response ? error.response.data : error.message);
        throw error;
    }
}

// Обработка команды /start
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const userName = msg.from.first_name || 'Друг'; // Имя пользователя или "Друг", если имя отсутствует

    // Текст приветственного сообщения
    const welcomeMessage = `
${userName} 👋

От идеи до реализации 

Приглашаем вас к нашему каналу «От идеи до реализации», посвященному продвижению блогов и созданию успешного контента. Если вы хотите превратить свои творческие идеи в реальность, изучить секреты продвижения и наладить сотрудничество с брендами, вы попали по адресу 🫶🏼

Канал станет вашим надежным спутником в мире блогинга.

В нем я буду делиться своими полезными советами, стратегиями продвижения, успешными кейсами и многими другими ресурсами, которые помогут вам создать и развить ваш блог.

Если конкретнее какие темы мы затронем: 
- Как сдвинуть свой блог с мертвой точки 
- Как начать набирать хорошие охваты и новую аудиторию 
- Как выйти на бартерное и коммерческое сотрудничество с брендами 
- Как работают алгоритмы, как отслеживать динамику и анализировать контент 
- Подборки идей для рилс которые в тренде 
- Монтаж, обработка, шрифты, музыка, стикеры, пресеты, как улучшить качество видео 
- Каким оборудованием я пользуюсь для создания качественного контента ❤️‍🔥
- Мой опыт, моё мнение, что помогает мне продолжать развиваться и получать результат 
- Разбор ошибок в блогах 
- Поддержка единомышленников, обратная связь 

Оформляйте подписку и становитесь частью нашего сообщества творческих и амбициозных людей.
— от идеи до реализации!

🔸 доступ: НАВСЕГДА 
🔸 формат: подкасты, статьи, уроки
`;

    // Ссылка на изображение
    const imageUrl = 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTqnha6aszARla9NiFlyeSV7H6MFxmE_o_h8A&s'; // Замените на реальную ссылку на изображение

    // Отправляем изображение отдельным сообщением
    await bot.sendPhoto(chatId, imageUrl);

    // Отправляем приветственный текст с кнопкой оплаты
    bot.sendMessage(chatId, welcomeMessage, {
        reply_markup: {
            inline_keyboard: [
                [{ text: "Оплатить 100₽", callback_data: "pay_100" }]
            ]
        }
    });
});

// Обработка нажатия кнопки "Оплатить"
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;

    if (query.data === "pay_100") {
        try {
            // Создаем платеж
            const paymentData = await createPayment(chatId, "100.00", "Доступ к закрытому каналу");

            // Отправляем ссылку для оплаты
            bot.sendMessage(chatId, `Перейдите по ссылке для оплаты: ${paymentData.confirmation.confirmation_url}`);
        } catch (error) {
            bot.sendMessage(chatId, "Произошла ошибка при создании платежа. Попробуйте позже.");
        }
    }
});

// Webhook для получения уведомлений от ЮKassa
const app = express();
app.use(express.json());

app.post('/webhook', async (req, res) => {
    const event = req.body;

    if (event.event === "payment.succeeded") {
        const chatId = event.object.metadata.chat_id;

        // Добавляем пользователя в канал
        try {
            // Уведомляем пользователя об успешной оплате
            await bot.sendMessage(chatId, "Оплата прошла успешно! Вы получили доступ к каналу.");

            // Добавляем пользователя в канал
            await bot.inviteChatMember(CHANNEL_ID, chatId);
        } catch (error) {
            console.error('Ошибка при добавлении пользователя в канал:', error);
            bot.sendMessage(chatId, "Произошла ошибка при добавлении вас в канал. Пожалуйста, свяжитесь с поддержкой.");
        }
    }

    res.sendStatus(200);
});

// Запуск сервера
app.listen(3000, () => {
    console.log('Сервер запущен на порту 3000');
});