require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
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

// Middleware
app.use(express.json());
app.use(express.static('public'));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/chat', chatRoutes);

app.get('/', (req, res) => {
    res.send('Agram API ishlamoqda...');
});

// Socket.io Real-time Direct Chat Engine
io.on('connection', (socket) => {
    console.log('⚡ Yangi foydalanuvchi ulandi:', socket.id);

    socket.on('join_chat', (userId) => {
        socket.join(userId);
        console.log(`Foydalanuvchi ${userId} xonasiga kirdi`);
    });

    socket.on('send_message', async (data) => {
        const { senderId, receiverId, text } = data;

        try {
            const newMessage = new Message({ sender: senderId, receiver: receiverId, text });
            await newMessage.save();

            io.to(receiverId).emit('receive_message', {
                senderId,
                text,
                createdAt: newMessage.createdAt
            });
        } catch (err) {
            console.error('Xabar saqlashda xatolik:', err);
        }
    });

    socket.on('disconnect', () => {
        console.log('🔴 Foydalanuvchi uzildi:', socket.id);
    });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server ${PORT}-portda ishga tushdi`));