const mongoose = require("mongoose");

const {Schema} = require("mongoose");

const commentSchema = new Schema({

        filmId: {
            type: Schema.ObjectId,
            ref: "Film",
            required: true
        },
        authorId: {
            type: Schema.ObjectId,
            ref: "User",
            required: true
        },
        authorName: {
            type: "String"
        },
        text: {
            type: String,
            required: true
        }
    },
    {
        timestamps: true
    });


commentSchema.methods = {
    view(full) {
        const view = {
            id: this._id,
            authorId: this.authorId,
            authorName: this.authorName,
            text: this.text,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };

        return full ? {
            ...view,
            filmId: this.filmId,
        } : view;
    }
};

const model = mongoose.model('Comment', commentSchema);

module.exports = {model, commentSchema};
