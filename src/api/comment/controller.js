const {success, notFound, noCommentsFound} = require('../../services/response');

const moment = require('moment');
const mongoose = require('mongoose');

const ObjectId = require('mongoose').Types.ObjectId;

const FilmDetails = require('../film/detailsModel').model;
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

        let details = await FilmDetails.findOneAndUpdate({film_id: film_id},{$inc: {comments_counter: 1 }}).session(session);

        if (details === null) {
            return notFound(res)(details);
        }

        let commentBody = {
            "film_id": film_id,
            "author_id": user._id,
            "author_name": user.name,
            "text": text
        };

        let comment = await Comment.create([commentBody], {session: session}).then(comments => comments[0].view(true))

        commentBody = { ...commentBody, _id: comment.id, createdAt: comment.createdAt, updatedAt: comment.updatedAt }
        delete commentBody.film_id


        details.comments.unshift(commentBody);

        if(details.comments.length > 10) details.comments.pop()

        await details.save();

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

    return Comment.findOne({_id: comment_id})
        .then(notFound(res))
        .then(comment => comment ? comment.view(true) : null)
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

        let details = await FilmDetails.findOne({ film_id: comment.film_id }).session(session)

        let filmComment = details.comments.find(c => c._id.equals(comment._id))

        comment.text = text

        if(filmComment) filmComment.text = text

        await details.save()
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

        if (!comment) {
            await session.abortTransaction()
            session.endSession()
            return notFound(res)(null);
        }

        if (!(user.role === 'admin' || user._id.equals(comment.author_id))) return res.status(403).end()

        let details = await FilmDetails.findOneAndUpdate({film_id: comment.film_id},{$inc: {comments_counter: -1 }})
            .session(session);

        let commentToInsert = await Comment.find({film_id: comment.film_id,
                 createdAt: {$lt: details.comments[details.comments.length - 1].createdAt}})
            .sort({createdAt: -1})
            .limit(1).session(session)

        let filmComment = details.comments.find(c => c._id.equals(comment._id))

        if(details.comments.length === 10 && commentToInsert.length > 0) {
            let commentBody = {
                "_id": commentToInsert[0]._id,
                "author_id": commentToInsert[0].author_id,
                "author_name": commentToInsert[0].author_name,
                "text": commentToInsert[0].text,
                "createdAt": commentToInsert[0].createdAt,
                "updatedAt": commentToInsert[0].updatedAt
            }
            await details.comments.push(commentBody)
        }

        if(filmComment) await details.comments.pull(filmComment)

        await Comment.deleteOne({_id: comment_id}).session(session)
        await details.save()

        await session.commitTransaction();
        session.endSession();

        return res.status(204).end();

    }).catch((err) => {
        console.error(err)
        return res.status(400).send({error: 'Something went wrong!'})
    })
};

const sortComments = async ({params, query}, res, next) => {

    const limit = parseInt(query.limit) || 10;
    const skip = parseInt(query.skip) || 0;

    let sort = {};

    if (query.created_at) {
        const value = query.created_at == 1 ? 1 : -1;
        sort = {...sort, "createdAt": value}
    }

    if (query.author_name) {
        const value = query.author_name == 1 ? 1 : -1;
        sort = {...sort, "author_name": value}
    }

    if (query.text) {
        const value = query.text == 1 ? 1 : -1;
        sort = {...sort, "text": value}
    }

    if (Object.keys(sort).length === 0) sort = {"comments._id": -1};

    await Comment.find({film_id: params.film_id})
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .then(comments => comments.map(comment => comment.view(true)))
        .then(success(res))
        .catch((err) => {
            return res.status(400).send({error: err}).end();
        });
};


const filterComments = async ({query, params}, res, next) => {

    const limit = parseInt(query.limit) || 10;
    const skip = parseInt(query.skip) || 0;

    let match = {film_id: params.film_id};

    if (query.date_start || query.date_end) {

        let dateStartObject = moment(query.date_start, "DD/MM/YYYY");
        let dateStart = dateStartObject.toDate();

        let dateEndObject = moment(query.date_end, "DD/MM/YYYY");
        let dateEnd = dateEndObject.toDate();

        if (isNaN(dateStart.getTime())) {
            let message = query.date_start ?
                {error: 'Bad dateStart format! Format must by DD/MM/YYYYY.'} : {error: 'Starting date cannot be empty!'};
            return res.status(400).send(message)
        }

        if (isNaN(dateEnd.getTime())) {
            if (query.date_end)
                return res.status(400).send({error: 'Bad dateEnd format! Format must by DD/MM/YYYYY.'});
            else dateEnd = moment().toDate()

        }

        match = {
            ...match, "createdAt": {
                "$gte": dateStart,
                "$lt": dateEnd
            }
        }
    }

    if (query.text) {
        match = {...match, "text": new RegExp(query.text)}
    }

    if (query.author_name) {
        match = {...match, "author_name": query.author_name}
    }

    await Comment.find(match)
        .skip(skip)
        .limit(limit)
        .then(comments => comments.map(comment => comment.view(true)))
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
