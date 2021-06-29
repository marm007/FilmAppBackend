const mongoose = require('mongoose');
const {Schema} = require('mongoose');

const Comment = require('../comment/model').commentSchema;
const Thumbnail = require('../thumbnail/model').thumbnailSchema;

const filmSchema = new Schema({
    title: {
        type: String,
        required: true,
    },
    author: {
        type: Schema.ObjectId,
        ref: 'User'
    },
    authorName: {
      type: String,
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
    },
    commentsCount: {
        type: Number,
        default: 0
    },
    comments: [Comment]

}, {
    timestamps: true,
});


filmSchema.pre('validate', function (next) {
    this.commentsCount = this.comments.length
    next()
})


filmSchema.methods = {
    view(full, withComments = false) {
        let view = {
            title: this.title,
            author: this.author,
            authorName: this.authorName,
            description: this.description,
            views: this.meta.views,
            thumbsUp: this.meta.likes,
            thumbsDown: this.meta.dislikes,
            thumbnail: this.thumbnail,
            commentsCount: this.commentsCount

        };

        if (withComments)
            view =  {...view, comments: this.comments}

        return full ? {
            id: this._id,
            ...view,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        } : view;
    }
};

const model = mongoose.model('Film', filmSchema);

module.exports = {model, filmSchema};
