const mongoose = require('mongoose');
const {Schema} = require('mongoose');

const playlistSchema = new Schema({
    title: {
        type: String,
        required: true,
    },
    author_id: {
        type: Schema.ObjectId,
        ref: 'User',
        required: true
    },
    author_name: {
        type: String,
        required: true
    },
    films_id: [{
            type: Schema.ObjectId,
            ref: "Film"
    }],
    is_public: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true,
});

playlistSchema.methods = {
    view(full) {
        const view = {
            title: this.title,
            author_id: this.author_id,
            author_name: this.author_name,
            films_id: this.films_id,
        };

        return full ? {
            ...view,
            id: this._id,
            is_public: this.is_public,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        } : view;
    }
};

const model = mongoose.model('Playlist', playlistSchema);

module.exports = {model, playlistSchema};
