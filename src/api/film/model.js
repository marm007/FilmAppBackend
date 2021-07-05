const mongoose = require('mongoose');
const {Schema} = require('mongoose');

const Thumbnail = require('../thumbnail/model').thumbnailSchema;

const filmSchema = new Schema({
    title: {
        type: String,
        required: true,
    },
    author_name: {
      type: String,
      required: true
    },
    author_id: {
        type: Schema.ObjectId,
        ref: 'User',
        required: true
    },
    description: {
        type: String,
        required: true
    },
    thumbnail: Thumbnail,
    meta: {
        views: {
            type: Number,
            default: 0
        },
        likes: {
            type: Number,
            default: 0
        },
        dislikes: {
            type: Number,
            default: 0
        }
    }
}, {
    timestamps: true,
});


filmSchema.methods = {
    view(full) {
        let view = {
            title: this.title,
            author_name: this.author_name,
            description: this.description,
            views: this.meta.views,
            likes: this.meta.likes,
            dislikes: this.meta.dislikes,
            thumbnail: this.thumbnail,
        };

        return full ? {
            id: this._id,
            ...view,
            author_id: this.author_id,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        } : view;
    }
};


const model = mongoose.model('Film', filmSchema);

module.exports = {model, filmSchema};
