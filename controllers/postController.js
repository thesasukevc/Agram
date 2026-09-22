const Post = require('../models/Post');
const Comment = require('../models/Comment');

// Barcha postlarni olish
exports.getAllPosts = async (req, res) => {
    try {
        const posts = await Post.find().populate('user', 'username avatar').sort({ createdAt: -1 });
        res.json(posts);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Yangi post yaratish
exports.createPost = async (req, res) => {
    try {
        const { caption, mediaUrl, mediaType, category } = req.body;
        const newPost = new Post({
            user: req.user.userId,
            caption,
            mediaUrl,
            mediaType,
            category
        });
        await newPost.save();
        res.status(201).json(newPost);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Like bosish/olib tashlash
exports.toggleLike = async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        if (!post) return res.status(404).json({ message: 'Post topilmadi' });

        const index = post.likes.indexOf(req.user.userId);
        if (index === -1) {
            post.likes.push(req.user.userId);
        } else {
            post.likes.splice(index, 1);
        }
        await post.save();
        res.json({ likesCount: post.likes.length, isLiked: index === -1 });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Izoh qo'shish
exports.addComment = async (req, res) => {
    try {
        const { text } = req.body;
        const comment = new Comment({
            post: req.params.id,
            user: req.user.userId,
            text
        });
        await comment.save();
        res.status(201).json(comment);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};