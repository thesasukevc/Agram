const express = require('express');
const router = express.Router();
const { getChatHistory } = require('../controllers/chatController');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/:partnerId', authMiddleware, getChatHistory);

module.exports = router;