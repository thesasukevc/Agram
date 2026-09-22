require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');
const Message = require('./models/Message');

const authRoutes = require('./routes/authRoutes');
const postRoutes = require('./routes/postRoutes');
const chatRoutes = require('./routes/chatRoutes');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*' }
});

// Bazaga ulanish
connectDB();

// Xavfsizlik
app.use(helmet({ contentSecurityPolicy: false }));
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    message: "Juda ko'p so'rov yuborildi, birozdan so'ng urinib ko'ring."
});
app.use(limiter);

app.use(express.json());
app.use(express.static('public'));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/chat', chatRoutes);

// Real-Time Socket Logic
const activeUsers = new Map();

io.on('connection', (socket) => {
    
    // Foydalanuvchi tarmoqqa kirdi
    socket.on('user_online', (userId) => {
        activeUsers.set(userId, socket.id);
        io.emit('online_users_update', Array.from(activeUsers.keys()));
    });

    // Direct Chat
    socket.on('send_message', async (data) => {
        const { senderId, receiverId, text } = data;
        try {
            const newMessage = new Message({ sender: senderId, receiver: receiverId, text });
            await newMessage.save();

            const receiverSocketId = activeUsers.get(receiverId);
            if (receiverSocketId) {
                io.to(receiverSocketId).emit('receive_message', {
                    senderId,
                    text,
                    createdAt: newMessage.createdAt
                });
            }
        } catch (err) {
            console.error('Xabar saqlashda xatolik:', err);
        }
    });

    // "Yozmoqda..." indikatori
    socket.on('typing', ({ senderId, receiverId, isTyping }) => {
        const receiverSocketId = activeUsers.get(receiverId);
        if (receiverSocketId) {
            io.to(receiverSocketId).emit('user_typing', { senderId, isTyping });
        }
    });

    // Real-time bildirishnomalar (Like, Comment)
    socket.on('send_notification', ({ targetUserId, message, type }) => {
        const targetSocket = activeUsers.get(targetUserId);
        if (targetSocket) {
            io.to(targetSocket).emit('new_notification', { message, type, time: new Date() });
        }
    });

    // Foydalanuvchi uzildi
    socket.on('disconnect', () => {
        for (let [userId, socketId] of activeUsers.entries()) {
            if (socketId === socket.id) {
                activeUsers.delete(userId);
                break;
            }
        }
        io.emit('online_users_update', Array.from(activeUsers.keys()));
    });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server ${PORT}-portda ishga tushdi`));