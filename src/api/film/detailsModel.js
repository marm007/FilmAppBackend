const mongoose = require('mongoose')
const {Schema} = require('mongoose')

const Comment = require('../comment/model').commentSchema;


const detailsSchema = new Schema({
    film_id: {
        type: Schema.ObjectId,
        ref: 'Film',
        required: true
    },
    author_id: {
        type: Schema.ObjectId,
        ref: 'User',
        required: true
    },
    comments_count: {
        type: Number,
        default: 0
    },
    comments: [Comment]

})



detailsSchema.methods = {
    view(full) {
        let view = {
            author_id: this.author_id,
            comments_count: this.comments_count,
            comments: this.comments
        }

        return full ? {id: this._id, film_id: this.film_id, ...view} : view
    }
}

const model = mongoose.model('FilmDetail', detailsSchema)

module.exports = {model, detailsSchema};
