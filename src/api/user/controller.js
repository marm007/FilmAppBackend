const {success, notFound} = require('../../services/response');
const {sign} = require('../../services/jwt');
const catchDuplicateEmail = require("./helpers").catchDuplicateEmail;

const mongoose = require('mongoose')

const User = require('./model').model;
const UserDetails = require('./detailsModel').model;

const Comment = require('../comment/model').model;
const Film = require('../film/model').model;
const Playlist = require('../playlist/model').model;

const ObjectId = require('mongoose').Types.ObjectId;

const create = async ({body}, res, next) => {
    const session = await mongoose.startSession()
    await session.withTransaction(async function executor() {
        let user = await User.create([body], {session: session})
        user = user[0]
        await UserDetails.create([{user_id: user._id, reset_password: {token: 1, expires: Date.now()}}], {session: session})

        let token = await sign(user)

        await session.commitTransaction()
        session.endSession()
        
        return success(res, 201)({token, user: user.view(true)})

    }).catch((err) => {
        return next(err)
    })
};

const all = (req, res, next) =>
    User.find()
        .then((users) => users.map((user) => user.view(true)))
        .then(success(res))
        .catch(next);

const index = async ({query, user, params}, res, next) => {
    const limit = parseInt(query.limit) || 10;
    const skip = parseInt(query.skip) || 0;

    let userObject = await User.findById(params.id).then(user => user ? user.view() : null)

    if(!userObject) return notFound(res)(null)

    let responseObject = {...userObject}

    if(query && query.full === true) {

        const match = user && ObjectId(userObject.id).equals(ObjectId(user.id)) ? {author_id: userObject.id} : {author_id: userObject.id, is_public: true}

        let comments = await Comment.find({author_id: userObject.id})
            .skip(skip).limit(limit).then(comments => comments.map(comment => comment.view()))
        let films = await Film.find({author_id: userObject.id})
            .skip(skip).limit(limit).then(films => films.map(film => film.view()))
        let playlists = await Playlist.find({match})
            .skip(skip).limit(limit).then(playlists => playlists.map(playlist => playlist.view()))
        responseObject = {...responseObject, comments, films, playlists}
    } 
   
    return success(res, 200)(responseObject)

}

    

const me = async ({user, query}, res, next) => {
   
    const limit = parseInt(query.limit) || 10;
    const skip = parseInt(query.skip) || 0;

    let me = await User.findById(user.id).then(user => user.view())

    let responseObject = {...me}

    if(query && query.full === true) {
        let comments = await Comment.find({author_id: user.id})
            .skip(skip).limit(limit).then(comments => comments.map(comment => comment.view()))
        let films = await Film.find({author_id: user.id})
            .skip(skip).limit(limit).then(films => films.map(film => film.view()))
        let playlists = await Playlist.find({author_id: user.id})
            .skip(skip).limit(limit).then(playlists => playlists.map(playlist => playlist.view()))
        responseObject = {...responseObject, comments, films, playlists}
    } 
   
    return success(res, 200)(responseObject)
}


const update = ({body, user}, res, next) =>
    User.findById(user.id)
        .then(notFound(res))
        .then(user => user ? Object.assign(user, body).save() : null)
        .then(user => user ? user.view(true) : null)
        .then(success(res))
        .catch(next);


const destroy = async ({user}, res, next) => {
    const session = await mongoose.startSession()

    await session.withTransaction(async function executor(){
        await User.deleteOne({_id: user.id}).session(session)
        await UserDetails.deleteOne({user_id: user.id}).session(session)
        
        await session.commitTransaction()
        session.endSession()

        return res.status(204).end()

    }).catch(next)
}

module.exports = {
    create,all, index, update, destroy, me
};
