const Message = require('../models/Message');

exports.getChatHistory = async (req, res) => {
    try {
        const { partnerId } = req.params;
        const myId = req.user.userId;

        const messages = await Message.find({
            $or: [
                { sender: myId, receiver: partnerId },
                { sender: partnerId, receiver: myId }
            ]
        }).sort({ createdAt: 1 });

        res.json(messages);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};