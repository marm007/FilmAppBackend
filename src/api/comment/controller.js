const {success, notFound, noCommentsFound} = require('../../services/response');

const moment = require('moment');
const mongoose = require('mongoose');

const ObjectId = require('mongoose').Types.ObjectId;

const FilmModel = require('../film/model').model;
const User = require('../user/model').model;
const Comment = require('./model').model;


const createComment = async (req, res, next) => {
    const session = await mongoose.startSession()
    await session.withTransaction(async function executor() {

        const {film_id} = req.params;
        const {text} = req.body;

        if (!text)
            return res.status(400).json({
                errors: ['path text is required']
            });

        let user = await User.findById(req.user._id, '_id nick comments').session(session)
        let film = await FilmModel.findById(film_id).session(session);

        if (film === null)
            return notFound(res)(film);

        if(user === null)
            return notFound(res)(user)

        const commentId = ObjectId();
        const comment = {
            "_id": commentId,
            "filmId": film_id,
            "authorId": user._id,
            "authorName": user.nick,
            "text": text
        };

        user.comments.unshift(commentId);
        film.comments.unshift(comment);

        await user.save();
        await film.save();

        await session.commitTransaction();
        session.endSession();

        return success(res)({
            ...comment,
            "createdAt": commentId.getTimestamp()
        })
    }).catch((err) => {
        console.log(err)
        return res.status(400).send({error: 'Something went wrong!'})
    })

};


const indexComment = async (req, res, next) => {
    const {film_id, commentId} = req.params;

    let film = await FilmModel.findOne({_id: film_id, comments: {$elemMatch: {_id: commentId}}});

    if (film === null || film.comments.length === 0)
        return notFound(res)(null);

    let comment = film.comments.filter(comment => {
        console.log(comment._id)
        console.log(commentId)
        console.log(typeof comment._id.toString())
        console.log(typeof commentId)
        console.log(comment._id == commentId)
        return comment._id === ObjectId(commentId)
    })

    return res.status(200).send(comment)
};

const getAllComments = async (req, res, next) => {

    FilmModel.findById({_id: req.params.film_id})
        .populate('comments')
        .then(notFound(res))
        .then((film) => film ? film.comments.map((comment) => comment.view(false)) : null)
        .then(success(res))
        .catch(next);
};

const updateComment = async (req, res, next) => {
    const {film_id, commentId} = req.params;
    const user = req.user;

    let film = await FilmModel.findOne({_id: film_id, comments: {$elemMatch: {_id: commentId}}});

    if (film === null || film.comments.length === 0)
        return notFound(res)(null);

    if (user.role === 'admin' || (user.comments.indexOf(commentId) > -1)) {

        if (req.body.text === null || req.body.text === undefined)
            return res.status(400).send({error: 'Path text is required'}).end();

        if (!(typeof req.body.text === 'string' || req.body.text instanceof String))
            return res.status(400).send({error: 'Path text must be of type String'}).end();

        FilmModel.findOneAndUpdate({comments: {$elemMatch: {_id: commentId}}}, {$set: {"comments.$.text": (req.body.text)}},
            {
                "projection": {
                    "comments": {
                        "$elemMatch": {"_id": commentId}
                    }
                },
                "new": true
            })
            .populate("comments")
            .then((film) => film ? film.comments.map((comment) => comment.view(true)) : null)
            .then(success(res))
            .catch(next);

    } else {
        return res.status(403).end()
    }

};

const destroyComment = async (req, res, next) => {
    const session = await mongoose.startSession();
    await session.withTransaction(async function executor() {
        const {film_id, commentId} = req.params;

        let film = await FilmModel.findOne({_id: film_id}, {comments: {$elemMatch: {_id: commentId}}});

        if (film === null || film.comments.length === 0)
            return notFound(res)(null);

        const userId = film.comments[0].authorId;

        if (!((req.user.role === 'admin') || (req.user._id.equals(userId))))
            return res.status(401).end();


        let newFilm = await FilmModel.findById(film_id)
            .session(session);

        await newFilm.comments.pull(commentId)
        await newFilm.save()

        await User.findOneAndUpdate({_id: userId}, {$pull: {comments: commentId}}, {new: true})
            .session(session);


        await session.commitTransaction();
        session.endSession();

        return res.status(200).end();

    }).catch((err) => {
        console.error(err)
        return res.status(400).send({error: 'Something went wrong!'})
    })
};

const sortComments = async ({params, query}, res, next) => {

    let film = await FilmModel.findById({_id: params.film_id});

    if (film === null)
        return notFound(res)(null);

    if (!query.limit || parseInt(query.limit) === 0) {
        return res.status(400).json({
            errors: 'Param limit required'
        }).end();
    }

    let sort = {};

    if (query.createdAt) {
        const value = query.createdAt == 1 ? 1 : -1;
        sort = {...sort, "comments.createdAt": value}
    }

    if (query.text) {
        const value = query.text == 1 ? 1 : -1;
        sort = {...sort, "comments.text": value}
    }

    if (query.authorName) {
        const value = query.authorName == 1 ? 1 : -1;
        sort = {...sort, "comments.authorName": value}
    }


    if (Object.keys(sort).length === 0) sort = {"comments._id": -1};

    FilmModel.aggregate([
        {"$match": {"_id": ObjectId(params.film_id)}},
        {"$unwind": "$comments"},
        {"$limit": parseInt(query.limit)},
        {
            "$sort": sort
        },
        {
            "$group": {
                "comments": {
                    "$push": "$comments",

                },
                "_id": 1
            }
        }, {
            "$project": {
                "_id": 0,
                "comments": 1,

            }
        }])
        .then(notFound(res))
        .then(noCommentsFound(res))
        .then(comments => comments[0].comments)
        .then(comments => comments.map(comment => {
            comment.id = comment._id;
            delete comment._id;
            return comment
        }))
        .then(success(res))
        .catch((err) => {
            return res.status(400).send({error: err}).end();
        });


};


const filterComments = async ({query, params}, res, next) => {

    let film = await FilmModel.findById({_id: params.film_id});

    if (film === null)
        return notFound(res)(null);

    let match = {};

    if (query.dateStart || query.dateEnd) {

        let dateStartObject = moment(query.dateStart, "DD/MM/YYYY");
        let dateStart = dateStartObject.toDate();

        let dateEndObject = moment(query.dateEnd, "DD/MM/YYYY");
        let dateEnd = dateEndObject.toDate();

        if (isNaN(dateStart.getTime())) {
            let message = query.dateStart ?
                {error: 'Bad dateStart format! Format must by DD/MM/YYYYY.'} : {error: 'Starting date cannot be empty!'};
            return res.status(400).send(message)
        }

        if (isNaN(dateEnd.getTime())) {
            if (query.dateEnd)
                return res.status(400).send({error: 'Bad dateEnd format! Format must by DD/MM/YYYYY.'});
            else dateEnd = moment().toDate()

        }


        match = {
            ...match, "comments.createdAt": {
                "$gte": dateStart,
                "$lt": dateEnd
            }
        }
    }

    if (query.text) {
        match = {...match, "comments.text": new RegExp(query.text)}
    }

    if (query.authorName) {
        match = {...match, "authorName": query.authorName}
    }

    FilmModel.aggregate([
        {"$match": {"_id": ObjectId(params.film_id)}},
        {
            "$unwind": "$comments"
        },
        {
            "$match": match
        }, {
            "$group": {
                "comments": {"$push": "$comments"},
                "_id": 1
            }
        }, {
            "$project": {
                "_id": 0,
                "comments": 1,

            }
        }])
        .then(notFound(res))
        .then(noCommentsFound(res))
        .then(comments => comments[0].comments)
        .then(comments => comments.map(comment => {
            comment.id = comment._id;
            delete comment._id;
            return comment
        }))
        .then(success(res))
        .catch((err) => {
            return res.status(400).send({error: err}).end();
        });

};

module.exports = {
    createComment,
    indexComment,
    getAllComments,
    updateComment,
    destroyComment,
    sortComments,
    filterComments
};
