const Post = require('../models/Post');
const { createClient } = require('@supabase/supabase-js');

// Supabase mijozini yaratish
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

// 1. Barcha postlarni olish (Populate user ma'lumotlari bilan)
exports.getAllPosts = async (req, res) => {
    try {
        const posts = await Post.find()
            .populate('user', 'username avatar')
            .populate('comments.user', 'username avatar')
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: posts.length,
            data: posts
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Postlarni yuklashda xatolik yuz berdi',
            error: error.message
        });
    }
};

// 2. Yangi post yaratish (Media fayl bo'lsa Supabase'ga yuklash)
exports.createPost = async (req, res) => {
    try {
        const { caption, category } = req.body;
        let mediaUrl = req.body.mediaUrl || '';

        // Agar multerning xotirasida (memoryStorage) fayl kelgan bo'lsa
        if (req.file) {
            const file = req.file;
            const fileExt = file.originalname.split('.').pop();
            const fileName = `posts/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

            const { data, error } = await supabase.storage
                .from(process.env.SUPABASE_BUCKET || 'agram-media')
                .upload(fileName, file.buffer, {
                    contentType: file.mimetype,
                    upsert: false
                });

            if (error) {
                return res.status(500).json({
                    success: false,
                    message: 'Faylni Supabase Storage ga yuklashda xatolik',
                    error: error.message
                });
            }

            // Ommaviy havola (Public URL) olish
            const { data: publicUrlData } = supabase.storage
                .from(process.env.SUPABASE_BUCKET || 'agram-media')
                .getPublicUrl(fileName);

            mediaUrl = publicUrlData.publicUrl;
        }

        if (!caption && !mediaUrl) {
            return res.status(400).json({
                success: false,
                message: 'Post sarlavhasi yoki media fayl kiritilishi shart'
            });
        }

        const newPost = new Post({
            user: req.user.userId,
            caption: caption || '',
            mediaUrl,
            category: category || 'All'
        });

        await newPost.save();
        await newPost.populate('user', 'username avatar');

        res.status(201).json({
            success: true,
            message: 'Post muvaffaqiyatli yaratildi',
            data: newPost
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Post yaratishda xatolik',
            error: error.message
        });
    }
};

// 3. Postga Like bosish / Likenini olib tashlash (Toggle)
exports.toggleLike = async (req, res) => {
    try {
        const postId = req.params.id;
        const userId = req.user.userId;

        const post = await Post.findById(postId);
        if (!post) {
            return res.status(404).json({ success: false, message: 'Post topilmadi' });
        }

        const likeIndex = post.likes.indexOf(userId);
        let isLiked = false;

        if (likeIndex === -1) {
            post.likes.push(userId);
            isLiked = true;
        } else {
            post.likes.splice(likeIndex, 1);
            isLiked = false;
        }

        await post.save();

        res.status(200).json({
            success: true,
            isLiked,
            likesCount: post.likes.length
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Like amaliyotida xatolik',
            error: error.message
        });
    }
};

// 4. Postga izoh (Comment) qo'shish
exports.addComment = async (req, res) => {
    try {
        const postId = req.params.id;
        const { text } = req.body;

        if (!text || !text.trim()) {
            return res.status(400).json({ success: false, message: 'Izoh matni bo\'sh bo\'lishi mumkin emas' });
        }

        const post = await Post.findById(postId);
        if (!post) {
            return res.status(404).json({ success: false, message: 'Post topilmadi' });
        }

        const newComment = {
            user: req.user.userId,
            text: text.trim(),
            createdAt: new Date()
        };

        post.comments.push(newComment);
        await post.save();

        await post.populate('comments.user', 'username avatar');

        res.status(201).json({
            success: true,
            message: 'Izoh qo\'shildi',
            data: post.comments
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Izoh qo\'shishda xatolik',
            error: error.message
        });
    }
};