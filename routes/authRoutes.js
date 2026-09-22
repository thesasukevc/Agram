const express = require('express');
const router = express.Router();
const multer = require('multer');
const storage = multer.memoryStorage();
const upload = multer({ storage });

const { register, login } = require('../controllers/authController');

router.post('/register', upload.single('avatar'), register);
router.post('/login', login);

module.exports = router;