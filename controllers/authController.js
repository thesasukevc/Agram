const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'https://placeholder-url.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'placeholder-key';
const supabase = createClient(supabaseUrl, supabaseKey);

// Ro'yxatdan o'tish (Register)
exports.register = async (req, res) => {
    try {
        const { firstName, lastName, username, email, password } = req.body;

        if (!firstName || !lastName || !username || !email || !password) {
            return res.status(400).json({ success: false, message: 'Barcha maydonlarni to\'ldiring' });
        }

        const existingEmail = await User.findOne({ email: email.trim().toLowerCase() });
        if (existingEmail) {
            return res.status(400).json({ success: false, message: 'Bu e-mail allaqachon ro\'yxatdan o\'tgan' });
        }

        const existingUsername = await User.findOne({ username: username.trim() });
        if (existingUsername) {
            return res.status(400).json({ success: false, message: 'Bu username band' });
        }

        // Avatar fayli yuklangan bo'lsa Supabase'ga joylash
        let avatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${username}`;
        if (req.file) {
            const file = req.file;
            const fileExt = file.originalname.split('.').pop();
            const fileName = `avatars/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

            const { error } = await supabase.storage
                .from(process.env.SUPABASE_BUCKET || 'agram-media')
                .upload(fileName, file.buffer, { contentType: file.mimetype });

            if (!error) {
                const { data } = supabase.storage
                    .from(process.env.SUPABASE_BUCKET || 'agram-media')
                    .getPublicUrl(fileName);
                avatarUrl = data.publicUrl;
            }
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = new User({
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            username: username.trim(),
            email: email.trim().toLowerCase(),
            password: hashedPassword,
            avatar: avatarUrl
        });

        await user.save();

        const token = jwt.sign(
            { userId: user._id, username: user.username },
            process.env.JWT_SECRET || 'super_secret_key_agram_2026',
            { expiresIn: '30d' }
        );

        res.status(201).json({
            success: true,
            token,
            user: {
                id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                username: user.username,
                email: user.email,
                avatar: user.avatar
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// Tizimga kirish (Login)
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ success: false, message: 'Bo\'sh maydonlarni to\'ldiring' });

        const user = await User.findOne({ email: email.trim().toLowerCase() });
        if (!user) return res.status(400).json({ success: false, message: 'Email yoki parol noto\'g\'ri' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ success: false, message: 'Email yoki parol noto\'g\'ri' });

        const token = jwt.sign(
            { userId: user._id, username: user.username },
            process.env.JWT_SECRET || 'super_secret_key_agram_2026',
            { expiresIn: '30d' }
        );

        res.status(200).json({
            success: true,
            token,
            user: {
                id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                username: user.username,
                email: user.email,
                avatar: user.avatar
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};