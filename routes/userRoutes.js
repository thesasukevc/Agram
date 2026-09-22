const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const authMiddleware = require('../middleware/authMiddleware');

// Qidiruv
router.get('/search', authMiddleware, async (req, res) => {
    try {
        const { query } = req.query;
        if (!query) return res.status(200).json({ success: true, users: [] });

        const users = await User.find({
            $or: [
                { username: { $regex: query, $options: 'i' } },
                { firstName: { $regex: query, $options: 'i' } },
                { lastName: { $regex: query, $options: 'i' } }
            ]
        }).select('firstName lastName username avatar followers following bio');

        res.status(200).json({ success: true, users });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Obuna bo'lish / Unfollow
router.put('/follow/:id', authMiddleware, async (req, res) => {
    try {
        const targetUserId = req.params.id;
        const currentUserId = req.user.userId;

        if (targetUserId === currentUserId) return res.status(400).json({ success: false, message: "O'zingizga obuna bo'la olmaysiz" });

        const targetUser = await User.findById(targetUserId);
        const currentUser = await User.findById(currentUserId);

        if (!targetUser || !currentUser) return res.status(404).json({ success: false, message: "Foydalanuvchi topilmadi" });

        const isFollowing = currentUser.following.includes(targetUserId);

        if (isFollowing) {
            currentUser.following.pull(targetUserId);
            targetUser.followers.pull(currentUserId);
        } else {
            currentUser.following.push(targetUserId);
            targetUser.followers.push(currentUserId);
        }

        await currentUser.save();
        await targetUser.save();

        res.status(200).json({ success: true, isFollowing: !isFollowing });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Profil ma'lumotlarini va Bio'ni yangilash
router.put('/profile', authMiddleware, async (req, res) => {
    try {
        const { firstName, lastName, bio } = req.body;
        const user = await User.findById(req.user.userId);

        if (!user) return res.status(404).json({ success: false, message: "Foydalanuvchi topilmadi" });

        if (firstName) user.firstName = firstName.trim();
        if (lastName) user.lastName = lastName.trim();
        if (bio !== undefined) user.bio = bio.trim();

        await user.save();

        res.status(200).json({
            success: true,
            user: {
                id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                username: user.username,
                email: user.email,
                avatar: user.avatar,
                bio: user.bio
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;