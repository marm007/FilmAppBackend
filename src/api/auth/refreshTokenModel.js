const mongoose = require('mongoose')
const { Schema } = require('mongoose')

const refreshTokenSchema = new Schema({
    user: { 
        type: Schema.ObjectId, 
        ref: 'User'
    },
    token: {
        type: String,
    },
    expires: Date
})

refreshTokenSchema.virtual('isExpired').get(function () {
    return Date.now() >= this.expires;
});

refreshTokenSchema.set('toJSON', {
    virtuals: true
})

const model = mongoose.model('RefreshToken', refreshTokenSchema)

module.exports = {
    model,
    refreshTokenSchema
}