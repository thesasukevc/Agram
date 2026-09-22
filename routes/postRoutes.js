const express = require('express');
const router = express.Router();
const { getAllPosts, createPost, toggleLike, addComment } = require('../controllers/postController');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/', getAllPosts);
router.post('/', authMiddleware, createPost);
router.put('/:id/like', authMiddleware, toggleLike);
router.post('/:id/comment', authMiddleware, addComment);

module.exports = router;