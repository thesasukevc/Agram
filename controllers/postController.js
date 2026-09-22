const Post = require('../models/Post');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

// Supabase mijozini yaratish
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

const BUCKET_NAME = process.env.SUPABASE_BUCKET || 'agram-media';

// Ruxsat etilgan fayl turlari
const ALLOWED_MIME_TYPES = [
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'video/mp4', 'video/webm', 'video/quicktime'
];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

// Yordamchi funksiya: fayl kengaytmasini xavfsiz olish
function getSafeExtension(filename, mimetype) {
    const ext = path.extname(filename || '').toLowerCase().replace('.', '');
    const allowedExts = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'mp4', 'webm', 'mov'];
    if (allowedExts.includes(ext)) return ext;

    // mimetype'dan taxmin qilish
    const map = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp',
        'image/gif': 'gif',
        'video/mp4': 'mp4',
        'video/webm': 'webm',
        'video/quicktime': 'mov'
    };
    return map[mimetype] || 'bin';
}

// 1. Barcha postlarni olish
exports.getAllPosts = async (req, res) => {
    try {
        const posts = await Post.find()
            .populate('user', 'username avatar')
            .populate('comments.user', 'username avatar')
            .sort({ createdAt: -1 })
            .lean(); // Performance uchun

        res.status(200).json({
            success: true,
            count: posts.length,
            data: posts
        });
    } catch (error) {
        console.error('[getAllPosts] xatolik:', error);
        res.status(500).json({
            success: false,
            message: 'Postlarni yuklashda xatolik yuz berdi',
            error: error.message
        });
    }
};

// 2. Yangi post yaratish
exports.createPost = async (req, res) => {
    try {
        if (!req.user || !req.user.userId) {
            return res.status(401).json({
                success: false,
                message: 'Avtorizatsiya talab qilinadi'
            });
        }

        const { caption, category } = req.body;
        let mediaUrl = req.body.mediaUrl || '';

        if (req.file) {
            const file = req.file;

            // Fayl hajmini tekshirish
            if (file.size > MAX_FILE_SIZE) {
                return res.status(400).json({
                    success: false,
                    message: `Fayl hajmi juda katta (maksimal ${MAX_FILE_SIZE / 1024 / 1024} MB)`
                });
            }

            // Fayl turini tekshirish
            if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
                return res.status(400).json({
                    success: false,
                    message: 'Fayl turi qo\'llab-quvvatlanmaydi'
                });
            }

            const fileExt = getSafeExtension(file.originalname, file.mimetype);
            const fileName = `posts/${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
                .from(BUCKET_NAME)
                .upload(fileName, file.buffer, {
                    contentType: file.mimetype,
                    upsert: false
                });

            if (uploadError) {
                console.error('[createPost] Supabase upload xatolik:', uploadError);
                return res.status(500).json({
                    success: false,
                    message: 'Faylni Supabase Storage ga yuklashda xatolik',
                    error: uploadError.message
                });
            }

            // getPublicUrl SINXRON — await kerak emas
            const { data: publicUrlData } = supabase.storage
                .from(BUCKET_NAME)
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
        console.error('[createPost] xatolik:', error);
        res.status(500).json({
            success: false,
            message: 'Post yaratishda xatolik',
            error: error.message
        });
    }
};

// 3. Like toggle (atomic operatorlar bilan)
exports.toggleLike = async (req, res) => {
    try {
        if (!req.user || !req.user.userId) {
            return res.status(401).json({ success: false, message: 'Avtorizatsiya talab qilinadi' });
        }

        const postId = req.params.id;
        const userId = req.user.userId;

        // Avval post mavjudligini va like holatini aniqlaymiz
        const post = await Post.findById(postId).select('likes');
        if (!post) {
            return res.status(404).json({ success: false, message: 'Post topilmadi' });
        }

        const hasLiked = post.likes.some(id => id.toString() === userId.toString());

        let updatedPost;
        if (hasLiked) {
            // Unlike — atomic $pull
            updatedPost = await Post.findByIdAndUpdate(
                postId,
                { $pull: { likes: userId } },
                { new: true }
            ).select('likes');
        } else {
            // Like — atomic $addToSet (dublikat oldini oladi)
            updatedPost = await Post.findByIdAndUpdate(
                postId,
                { $addToSet: { likes: userId } },
                { new: true }
            ).select('likes');
        }

        if (!updatedPost) {
            return res.status(404).json({ success: false, message: 'Post topilmadi' });
        }

        res.status(200).json({
            success: true,
            isLiked: !hasLiked,
            likesCount: updatedPost.likes.length
        });
    } catch (error) {
        console.error('[toggleLike] xatolik:', error);
        res.status(500).json({
            success: false,
            message: 'Like amaliyotida xatolik',
            error: error.message
        });
    }
};

// 4. Izoh qo'shish
exports.addComment = async (req, res) => {
    try {
        if (!req.user || !req.user.userId) {
            return res.status(401).json({ success: false, message: 'Avtorizatsiya talab qilinadi' });
        }

        const postId = req.params.id;
        const { text } = req.body;

        if (!text || !text.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Izoh matni bo\'sh bo\'lishi mumkin emas'
            });
        }

        if (text.trim().length > 1000) {
            return res.status(400).json({
                success: false,
                message: 'Izoh juda uzun (maksimal 1000 belgi)'
            });
        }

        const newComment = {
            user: req.user.userId,
            text: text.trim(),
            createdAt: new Date()
        };

        // Atomic push
        const post = await Post.findByIdAndUpdate(
            postId,
            { $push: { comments: newComment } },
            { new: true }
        ).populate('comments.user', 'username avatar');

        if (!post) {
            return res.status(404).json({ success: false, message: 'Post topilmadi' });
        }

        // Faqat oxirgi qo'shilgan commentni qaytaramiz
        const addedComment = post.comments[post.comments.length - 1];

        res.status(201).json({
            success: true,
            message: 'Izoh qo\'shildi',
            data: addedComment
        });
    } catch (error) {
        console.error('[addComment] xatolik:', error);
        res.status(500).json({
            success: false,
            message: 'Izoh qo\'shishda xatolik',
            error: error.message
        });
    }
};