const mongoose = require('mongoose');

const storySchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    mediaUrl: { type: String, required: true },
    createdAt: { type: Date, default: Date.now, expires: 86400 } // 24 soatdan (86400 sek) so'ng avto-o'chadi
});

module.exports = mongoose.model('Story', storySchema);