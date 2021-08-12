const mongoose = require('mongoose');
const {Schema} = require('mongoose');

const thumbnailSchema = new Schema({
    small: {
        type: Schema.ObjectId
    },
    small_webp: {
        type: Schema.ObjectId
    },
    poster: {
        type: Schema.ObjectId
    }
});


thumbnailSchema.methods = {
    view(full) {
        return {
            id: this._id,
            small: this.small,
            small_webp: this.small_webp,
            poster: this.poster
        };
    }
};

const model = mongoose.model('Thumbnail', thumbnailSchema);

module.exports = {model, thumbnailSchema};