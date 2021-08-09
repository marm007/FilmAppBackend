const bcrypt = require('bcrypt');
const mongoose = require('mongoose')
const roles = ['user', 'admin'];

const Comment = require('../comment/model').model;
const FilmDetails = require('../film/detailsModel').model;
const Film = require('../film/model').model;
const Playlist = require('../playlist/model').model;

const Schema = mongoose.Schema;

const userSchema = new Schema({
    email: {
        type: String,
        match: /^\S+@\S+\.\S+$/,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    password: {
        type: String,
        required: true,
        minlength: 6
    },
    name: {
        type: String,
        trim: true,
        required: true
    },
    role: {
        type: String,
        enum: roles,
        default: 'user'
    },
}, {
    timestamps: true
});

userSchema.pre('save', function (next) {
    if (this.isModified('name')) {
        this.isNameModifed = true
    }

    if (!this.isModified('password'))
        return next();


    const rounds = 9;

    bcrypt.hash(this.password, rounds).then((hash) => {
        this.password = hash;
        next();
    }).catch(next);

});

userSchema.post('save', async function (doc) {
    try {
        if (this.isNameModifed === true) {
            let films = await FilmDetails.find({ 'comments.author_id': doc._id })

            for (let film of films) {

                film.comments = film.comments.map(comment => {
                    if (comment.author_id.equals(doc._id))
                        comment.author_name = doc.name
                    return comment
                })

                await film.save()
            }

            await Film.updateMany({ author_id: doc._id }, { author_name: doc.name })
            await Comment.updateMany({ author_id: doc._id }, { author_name: doc.name })
            await Playlist.updateMany({ author_id: doc._id }, { author_name: doc.name })
        }
    } catch (err) {
        console.log(err)
    }
})

userSchema.methods = {
    view(full) {
        let view = {};
        let fields = ['id', 'name', 'email'];

        if (full) fields = [...fields, 'role'];

        fields.forEach((field) => {
            view[field] = this[field]
        });

        return view;
    },

    authenticate(password) {
        return bcrypt.compare(password, this.password).then((valid) => valid ? this : false);
    }
};

userSchema.statics = {
    roles
};

const model = mongoose.model('User', userSchema);

module.exports = { model, userSchema };
