require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const mongoose = require('mongoose');
const { Server } = require('socket.io');

const Message = require('./models/Message');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST", "PUT", "DELETE"]
    }
});

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB Atlas ulanishi
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://kzoimov:kozimov1224@cluster0.7tdr9gu.mongodb.net/agram?retryWrites=true&w=majority';

mongoose.connect(MONGO_URI)
    .then(() => console.log('MongoDB Atlas-ga muvaffaqiyatli ulandi'))
    .catch(err => console.error('MongoDB ulanishida xatolik:', err));

// API Marshrutilari
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/posts', require('./routes/postRoutes'));
app.use('/api/users', require('./routes/userRoutes'));

// Socket.io Real-time logikasi
const onlineUsers = new Map(); // userId -> socketId

io.on('connection', (socket) => {
    // Online bo'lganda
    socket.on('user_online', (userId) => {
        if (userId) {
            onlineUsers.set(userId.toString(), socket.id);
            io.emit('online_users_list', Array.from(onlineUsers.keys()));
        }
    });

    // Real-time Direct Chat
    socket.on('send_direct_message', async ({ receiverId, text, senderId }) => {
        try {
            if (!receiverId || !text || !senderId) return;

            const newMessage = new Message({
                sender: senderId,
                receiver: receiverId,
                text
            });

            await newMessage.save();
            await newMessage.populate('sender', 'username avatar firstName lastName');

            const receiverSocketId = onlineUsers.get(receiverId.toString());
            if (receiverSocketId) {
                io.to(receiverSocketId).emit('receive_direct_message', newMessage);
            }
            
            socket.emit('message_sent', newMessage);
        } catch (err) {
            console.error("Socket Direct Xatolik:", err);
        }
    });

    // Notification yuborish
    socket.on('send_notification', ({ targetUserId, message, type }) => {
        const receiverSocketId = onlineUsers.get(targetUserId.toString());
        if (receiverSocketId) {
            io.to(receiverSocketId).emit('new_notification', {
                message,
                type,
                time: new Date()
            });
        }
    });

    socket.on('disconnect', () => {
        for (let [userId, socketId] of onlineUsers.entries()) {
            if (socketId === socket.id) {
                onlineUsers.delete(userId);
                break;
            }
        }
        io.emit('online_users_list', Array.from(onlineUsers.keys()));
    });
});

// SPA Fallback
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server ${PORT}-portda ishlamoqda`);
});