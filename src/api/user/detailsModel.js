const mongoose = require('mongoose')

const Schema = mongoose.Schema;

const userDetailsSchema = new Schema({
    user_id: {
        type: Schema.ObjectId,
        ref: "User",
        required: true
    },
    liked: [{
        type: Schema.ObjectId,
        ref: "Film"
    }]
    ,
    disliked: [{
        type: Schema.ObjectId,
        ref: "Film"
    }],
    reset_password: {
        token: String,
        expires: Date
    }
});


userDetailsSchema.methods = {
    view(full) {
        const view = {
            liked: this.liked,
            disliked: this.disliked,
        };

        return full ? {...view, user_id: this.user_id} : view
    }
};

const model = mongoose.model('UserDetails', userDetailsSchema);

module.exports = {model, userDetailsSchema};
