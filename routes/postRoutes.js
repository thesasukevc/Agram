const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const { createClient } = require('@supabase/supabase-js');

const Post = require('../models/Post');
const Story = require('../models/Story');
const authMiddleware = require('../middleware/authMiddleware');

const supabaseUrl = process.env.SUPABASE_URL || 'https://placeholder-url.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'placeholder-key';
const supabase = createClient(supabaseUrl, supabaseKey);

// 1. Postlarni olish
router.get('/', async (req, res) => {
    try {
        const posts = await Post.find()
            .populate('user', 'firstName lastName username avatar')
            .populate('comments.user', 'firstName lastName username avatar')
            .sort({ createdAt: -1 });
        res.status(200).json({ success: true, data: posts });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 2. Yangi Post Yuklash
router.post('/', authMiddleware, upload.single('media'), async (req, res) => {
    try {
        const { caption } = req.body;
        let mediaUrl = '';
        let mediaType = 'none';

        if (req.file) {
            const file = req.file;
            const isVideo = file.mimetype.startsWith('video');
            mediaType = isVideo ? 'video' : 'image';

            const fileExt = file.originalname.split('.').pop();
            const fileName = `posts/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

            const { error } = await supabase.storage
                .from(process.env.SUPABASE_BUCKET || 'agram-media')
                .upload(fileName, file.buffer, { contentType: file.mimetype });

            if (!error) {
                const { data } = supabase.storage
                    .from(process.env.SUPABASE_BUCKET || 'agram-media')
                    .getPublicUrl(fileName);
                mediaUrl = data.publicUrl;
            }
        }

        const newPost = new Post({
            user: req.user.userId,
            caption,
            mediaUrl,
            mediaType
        });

        await newPost.save();
        await newPost.populate('user', 'firstName lastName username avatar');

        res.status(201).json({ success: true, post: newPost });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 3. Like Bosish / Bekor qilish
router.put('/:id/like', authMiddleware, async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        if (!post) return res.status(404).json({ success: false, message: "Post topilmadi" });

        const userId = req.user.userId;
        const likedIndex = post.likes.indexOf(userId);

        if (likedIndex > -1) {
            post.likes.splice(likedIndex, 1);
        } else {
            post.likes.push(userId);
        }

        await post.save();
        res.status(200).json({ success: true, likes: post.likes });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 4. Izoh Qoldirish
router.post('/:id/comment', authMiddleware, async (req, res) => {
    try {
        const { text } = req.body;
        if (!text) return res.status(400).json({ success: false, message: "Izoh bo'sh bo'lishi mumkin emas" });

        const post = await Post.findById(req.params.id);
        if (!post) return res.status(404).json({ success: false, message: "Post topilmadi" });

        post.comments.push({ user: req.user.userId, text });
        await post.save();
        await post.populate('comments.user', 'firstName lastName username avatar');

        res.status(200).json({ success: true, comments: post.comments });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 5. Stories Yuklash
router.post('/stories', authMiddleware, upload.single('media'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, message: "Rasm/Video yuklang" });

        const file = req.file;
        const fileExt = file.originalname.split('.').pop();
        const fileName = `stories/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { error } = await supabase.storage
            .from(process.env.SUPABASE_BUCKET || 'agram-media')
            .upload(fileName, file.buffer, { contentType: file.mimetype });

        if (error) throw error;

        const { data } = supabase.storage
            .from(process.env.SUPABASE_BUCKET || 'agram-media')
            .getPublicUrl(fileName);

        const newStory = new Story({
            user: req.user.userId,
            mediaUrl: data.publicUrl
        });

        await newStory.save();
        await newStory.populate('user', 'firstName lastName username avatar');

        res.status(201).json({ success: true, story: newStory });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 6. Faol Stories'larni Olish
router.get('/stories', async (req, res) => {
    try {
        const stories = await Story.find()
            .populate('user', 'firstName lastName username avatar')
            .sort({ createdAt: -1 });
        res.status(200).json({ success: true, stories });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;