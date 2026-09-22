const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
        return res.status(401).json({ message: 'Avtorizatsiyadan o\'tilmagan, token yo\'q' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secretkey123');
        req.user = decoded;
        next();
    } catch (err) {
        res.status(401).json({ message: 'Yaroqsiz token' });
    }
};

module.exports = authMiddleware;