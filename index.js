require('dotenv').config();
const fs = require('fs')
const path = require('path');
const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');
const { v4: uuidv4 } = require('uuid');
const express = require('express');

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN; // Токен бота
const SHOP_ID = process.env.SHOP_ID; // ID магазина в ЮKassa
const API_KEY = process.env.API_KEY; // Секретный ключ API ЮKassa
const CHANNEL_ID = process.env.CHANNEL_ID; // Username или числовой ID канала
const returnUrl = 'https://t.me/BlogGidBot'; // URL для редиректа после оплаты

// Инициализация бота
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

// Функция для создания платежа через ЮKassa
async function createPayment(chatId, amount, description) {
    const url = 'https://api.yookassa.ru/v3/payments';
    const idempotenceKey = uuidv4(); // Генерируем уникальный ключ идемпотентности

    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(`${SHOP_ID}:${API_KEY}`).toString('base64')}`,
        'Idempotence-Key': idempotenceKey // Добавляем ключ идемпотентности
    };

    const payload = {
        amount: {
            value: amount,
            currency: "RUB"
        },
        confirmation: {
            type: "redirect",
               return_url: returnUrl // URL для редиректа после оплаты
        },
        capture: true,
        description: description,
        metadata: {
            chat_id: chatId // Сохраняем chatId для идентификации пользователя
        }
    };

    try {
        const response = await axios.post(url, payload, { headers });

        // Анализируем HTTP-статус и статус объекта
        if (response.status === 200) {
            const paymentData = response.data;

            // Успешная операция
            if (paymentData.status === "succeeded") {
                console.log("Операция успешна:", paymentData);
                return paymentData;
            }

            // Операция ожидает завершения
            if (paymentData.status === "pending") {
                console.log("Операция ожидает завершения. Ждите уведомление.");
                return paymentData;
            }

            // Операция отменена
            if (paymentData.status === "canceled") {
                console.error("Операция отменена:", paymentData.cancellation_details || "Причина не указана");
                throw new Error("Оплата отменена. Попробуйте снова.");
            }

            // Другие статусы
            console.log("Неизвестный статус объекта:", paymentData.status);
            return paymentData;
        } else {
            console.error("Неожиданный HTTP-статус:", response.status, response.data);
            throw new Error("Не удалось создать платеж. Проверьте данные запроса.");
        }
    } catch (error) {
        // Обработка ошибок
        if (error.response) {
            const { status, data } = error.response;

            // Ошибки клиента (4xx)
            if (status >= 400 && status < 500) {
                console.error("Ошибка клиента:", status, data.description || data);
                throw new Error(`Ошибка при создании платежа: ${data.description || "Проверьте данные запроса"}`);
            }

            // Ошибка сервера (500)
            if (status === 500) {
                console.error("Ошибка сервера (500). Результат обработки неизвестен.");
                throw new Error("Результат обработки запроса неизвестен. Попробуйте позже.");
            }

            // Другие HTTP-ошибки
            console.error("Неожиданная ошибка:", status, data);
            throw new Error("Произошла ошибка при создании платежа.");
        } else {
            // Сетевые ошибки
            console.error("Сетевая ошибка:", error.message);
            throw new Error("Не удалось подключиться к ЮKassa. Проверьте соединение.");
        }
    }
}

// Функция для проверки, является ли пользователь участником канала
async function isUserInChannel(chatId, userId) {
    try {
        const member = await bot.getChatMember(CHANNEL_ID, userId);
        // Проверяем статус участника
        return ['member', 'administrator', 'creator'].includes(member.status);
    } catch (error) {
        console.error('Ошибка при проверке участника канала:', error.message);
        return false;
    }
}

// Обработка команды /start
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const userName = msg.from.first_name || 'Добро пожаловать'; // Имя пользователя или "Друг", если имя отсутствует

    // Проверяем, является ли пользователь участником канала
    const isMember = await isUserInChannel(chatId, userId);

    if (isMember) {
    // Если пользователь уже в канале, отправляем сообщение с кнопкой для перехода в канал
        const inviteLink = await bot.exportChatInviteLink(CHANNEL_ID);

        bot.sendMessage(chatId, `
${userName}, вы уже являетесь участником закрытого канала! ✅

Нажмите кнопку ниже, чтобы перейти в канал:
            `, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: "Перейти в канал", url: inviteLink }]
                ]
            }
        });
        return;
    }

    try {
        // Создаем платеж
        const paymentData = await createPayment(chatId, "100.00", "Доступ к закрытому каналу");

        // Текст приветственного сообщения
        const welcomeMessage = `
${userName} 👋

От идеи до реализации

Приглашаем вас к нашему каналу «От идеи до реализации», посвященному продвижению блогов и созданию успешного контента. Если вы хотите превратить свои творческие идеи в реальность, изучить секреты продвижения и наладить сотрудничество с брендами, вы попали по адресу.

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
        const imagePath = path.join(__dirname, 'preview.jpg');

        // Отправляем изображение отдельным сообщением
        await bot.sendPhoto(chatId, fs.createReadStream(imagePath), { contentType: 'image/jpeg' } );

        // Отправляем приветственный текст с кнопкой оплаты
        bot.sendMessage(chatId, welcomeMessage, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: "Оплатить 100₽", url: paymentData.confirmation.confirmation_url }]
                ]
            }
        });
    } catch (error) {
        console.error("Ошибка при создании платежа:", error.message);
        bot.sendMessage(chatId, "Произошла ошибка при создании платежа. Попробуйте позже.");
    }
});

const app = express();
app.use(express.json());

// Добавляем обработчик корневого запроса
app.get('/', (req, res) => {
    res.send('Бот работает! 🚀');
});

// Webhook для получения уведомлений от ЮKassa

app.post('/webhook', async (req, res) => {
    const event = req.body;

    // Логируем полное событие от ЮKassa
    console.log("📩 Получено уведомление от ЮKassa:", JSON.stringify(event, null, 2));

    try {
        if (event.event === "payment.succeeded") {
            const chatId = event.object?.metadata?.chat_id;

            console.log("🆔 Извлечённый chat_id из webhook:", chatId);

            if (!chatId) {
                console.error("❌ chat_id отсутствует в metadata!");
                return res.sendStatus(400);
            }

            // Пробуем получить информацию о пользователе
            try {
                const userInfo = await bot.getChat(chatId);
                console.log("✅ Пользователь найден:", userInfo.username || userInfo.first_name || "Без имени");

                // Генерируем пригласительную ссылку
                const inviteLink = await bot.exportChatInviteLink(CHANNEL_ID);
                console.log("🔗 Сгенерирована ссылка:", inviteLink);

                // Отправляем сообщение
                await bot.sendMessage(chatId, "🎉 Оплата прошла успешно! Вы можете войти в закрытый канал:", {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: "Перейти в канал", url: inviteLink }]
                        ]
                    }
                });

                console.log("✅ Сообщение успешно отправлено!");
            } catch (error) {
                console.error("❌ Ошибка при работе с Telegram API:", error.message);
                return res.status(400).send("Ошибка доступа к chat_id или Telegram API");
            }

        } else if (event.event === "payment.waiting_for_capture") {
            console.log("⏳ Платёж ожидает подтверждения:", event.object.id);
        } else if (event.event === "payment.canceled") {
            console.log("❌ Платёж отменён:", event.object.id);
        } else {
            console.log("⚠️ Неизвестное событие:", event.event);
        }

        res.sendStatus(200);
    } catch (error) {
        console.error("💥 Ошибка при обработке webhook:", error.message);
        res.sendStatus(500);
    }
});


// Запуск сервера
app.listen(3000, () => {
    console.log('Сервер запущен на порту 3000');
});