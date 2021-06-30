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
        const user = req.user
        const {film_id} = req.params;
        const {text} = req.body;

        if (!text)
            return res.status(400).json({
                errors: ['path text is required']
            });

        let film = await FilmModel.findById(film_id).session(session);

        if (film === null)
            return notFound(res)(film);

        let commentBody = {
            "film_id": film_id,
            "author_id": user._id,
            "author_name": user.name,
            "text": text
        };

        let comment = await Comment.create([commentBody], {session: session}).then(comments => comments[0].view(true))
        
        commentBody = { ...commentBody, _id: comment.id, createdAt: comment.createdAt, updatedAt: comment.updatedAt }
        delete commentBody.film_id
        
        film.comments.unshift(commentBody);

        if(film.comments.length > 10) film.comments.pop()

        await film.save();

        await session.commitTransaction();
        session.endSession();

        return success(res)({
            ...comment
        })
    }).catch((err) => {
        console.log(err)
        return res.status(400).send({error: 'Something went wrong!'})
    })

};

const index = async (req, res, next) => {


    const {comment_id} = req.params;

    if (!ObjectId.isValid(comment_id)) return res.status(400).end();

    Comment.findOne({_id: comment_id})
        .then(notFound(res))
        .then(comment => comment.view(true))
        .then(success(res))
        .catch(next)
};

const getAllComments = async (req, res, next) => {

    Comment.find({film_id: req.params.film_id})
        .then(notFound(res))
        .then(comments => comments ? comments.map((comment) => comment.view(false)) : null)
        .then(success(res))
        .catch(next);
};

const update = async (req, res, next) => {

    const user = req.user;

    const {comment_id} = req.params;
    const {text} = req.body

    const session = await mongoose.startSession()

    await session.withTransaction(async function executor() {

        let comment = await Comment.findOne({_id: comment_id}).session(session);

        if (!comment) return notFound(res)(null);

        if (!(user.role === 'admin' || user._id.equals(comment.author_id))) return res.status(403).end()

        if (text === null || text === undefined) return res.status(400).send({error: 'Path text is required'})
    
        if (!(typeof text === 'string' || text instanceof String))
            return res.status(400).send({error: 'Path text must be of type String'})
    
        let film = await FilmModel.findOne({ _id: comment.film_id }).session(session)

        let filmComment = film.comments.find(c => c._id.equals(comment._id))

        comment.text = text

        if(filmComment) filmComment.text = text

        await film.save()
        await comment.save()
        
        await session.commitTransaction()
        session.endSession()

        return res.status(200).send(comment.view(false))
    }).catch((err) => {
        console.error(err)
        return res.status(500).send({error: 'Something went wrong!'})
    })

};

const destroy = async (req, res, next) => {
    const session = await mongoose.startSession();
    await session.withTransaction(async function executor() {
        const {comment_id} = req.params;
        const user = req.user

        let comment = await Comment.findOne({_id: comment_id}).session(session);

        if (!comment) return notFound(res)(null);

        if (!(user.role === 'admin' || user._id.equals(comment.author_id))) return res.status(401).end()

        let film = await FilmModel.findOne({_id: comment.film_id}).session(session)
        
        let commentToInsert = await Comment.find({film_id: comment.film_id,
                 createdAt: {$lt: film.comments[film.comments.length - 1].createdAt}})
            .sort({createdAt: -1})
            .limit(1).session(session)
        
        let filmComment = film.comments.find(c => c._id.equals(comment._id))

        if(film.comments.length === 10 && commentToInsert.length > 0) {
            let commentBody = {
                "_id": commentToInsert[0]._id,
                "author_id": commentToInsert[0].author_id,
                "author_name": commentToInsert[0].author_name,
                "text": commentToInsert[0].text,
                "createdAt": commentToInsert[0].createdAt,
                "updatedAt": commentToInsert[0].updatedAt
            }
            await film.comments.push(commentBody)
        }

        if(filmComment) await film.comments.pull(filmComment)

        await comment.remove()
        await film.save()

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

    if (query.author_name) {
        const value = query.author_name == 1 ? 1 : -1;
        sort = {...sort, "comments.author_name": value}
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

    if (query.author_name) {
        match = {...match, "author_name": query.author_name}
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
    index,
    getAllComments,
    update,
    destroy,
    sortComments,
    filterComments
};
