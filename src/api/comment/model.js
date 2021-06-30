const mongoose = require("mongoose");

const {Schema} = require("mongoose");

const commentSchema = new Schema({
        film_id: {
            type: Schema.ObjectId,
            ref: "Film"
        },
        author_id: {
            type: Schema.ObjectId,
            ref: "User",
            required: true
        },
        author_name: {
            type: "String",
            required: true
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
            author_id: this.author_id,
            author_name: this.author_name,
            text: this.text,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };

        return full ? {
            ...view,
            film_id: this.film_id,
        } : view;
    }
};

const model = mongoose.model('Comment', commentSchema);

module.exports = {model, commentSchema};
