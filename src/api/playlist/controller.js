const mongoose = require('mongoose');

const { success, notFound } = require('../../services/response/');

const catchFilmNonExists = require('./helper').catchFilmNonExists;

const Playlist = require('./model').model;
const Film = require('../film/model').model;

const create = async ({ user, body }, res, next) => {
    const session = await mongoose.startSession()
    await session.withTransaction(async function executor() {
        let { films_id, title, is_public } = body;

        if (is_public === undefined) is_public = true
        else {
            if (!(typeof is_public === 'boolean' || is_public instanceof Boolean))
                return res.status(400).send({ error: 'Is public must be either true or false!' })
        }

        films_id = [...new Set(films_id)];

        const playlistBody = {
            is_public: is_public,
            films_id: films_id,
            title: title,
            author_id: user._id,
            author_name: user.name
        }

        let playlist = await Playlist.create(playlistBody)

        await session.commitTransaction();
        session.endSession();

        return success(res, 201)(playlist.view(true))
    }).catch(err => {
        console.error(err)
        return next(err)
    })

};

const index = async ({ params, user, query }, res, next) => {
    try {
        const playlist = await Playlist.findById(params.id)

        if (!playlist) return notFound(res)(null)

        if (!playlist.is_public && (!user || !playlist.author_id.equals(user._id))) {
            return res.status(403).end()
        }

        if (query.reload) {
            let playlistPopulated = await playlist
                .populate({ path: 'films_id', $exists: true, select: 'thumbnail', perDocumentLimit: 1 })
                .execPopulate()

            playlistPopulated = playlistPopulated.view(true)
            if (playlistPopulated.films.length > 0)
                playlistPopulated.film_id = playlistPopulated.films[0]._id

            delete playlistPopulated.films
            return success(res)(playlistPopulated)

        } else {
            const films_id = playlist.films_id.map(id => id.toString())

            let playlistPopulated = await playlist
                .populate({
                    path: 'films_id', select: '_id author_name title thumbnail', options: {
                        retainNullValues: true
                    }
                })
                .execPopulate()

            playlistPopulated = playlistPopulated.view(true)

            playlistPopulated.films = playlistPopulated.films.map((film, index) => film ? film.view(true) :
                {
                    id: films_id[index],
                    isNonExisting: true
                })


            return success(res)(playlistPopulated)
        }

    } catch (err) {
        console.log(err)
        return next(err)
    }
}

const showAll = (req, res, next) => {

    const user = req.user

    const limit = parseInt(req.query.limit) || 10;
    const skip = parseInt(req.query.skip) || 0;

    let filter = user ? { $or: [{ 'author_id': user._id }, { 'is_public': true }] } : { 'is_public': true }
    filter = { ...filter, films_id: { $exists: true, $not: { $size: 0 } } }

    {
        /*  Playlist.aggregate([
         {
             "$match": filter
         },
         {
             "$unwind": {
                 "path": "$films_id",
                 "preserveNullAndEmptyArrays": false
             }
         },
         { "$lookup": {
             "from": Film.collection.name,
             "localField": "films_id",
             "foreignField": "_id",
             "as": "film",
             
           }
         },
         
     ])
         .then(success(res))
         .catch(err => {
             console.log(err)
             next(err)
         }) */
    }//

    Playlist.find(filter)
        .populate({ path: 'films_id', $exists: true, select: 'thumbnail', perDocumentLimit: 1 })
        .skip(skip)
        .limit(limit)
        .then(playlists => {
            return playlists.map(playlist => {
                playlist = playlist.view(true)
                if (playlist.films.length > 0)
                    playlist.film_id = playlist.films[0]._id
                delete playlist.films

                return playlist
            })
        })
        .then(success(res))
        .catch(next)

}


const update = async ({ user, body, params }, res, next) => {

    const { title, films_id } = body;

    if (title === undefined || title === null)
        return res.status(400).json({
            errors: "Title is required!"
        }).end();

    if (!(typeof title === 'string' || title instanceof String))
        return res.status(400).json({
            errors: "Path title must be of type String!"
        }).end();

    if (films_id === undefined || films_id === null || films_id.length === 0)
        return res.status(400).json({
            errors: "Path films_id array is required!"
        }).end();

    if (!(films_id instanceof Array))
        return res.status(400).json({
            errors: "Path films_id must be of type Array!"
        }).end();


    let playlist = await Playlist.findById(params.id)

    if (!playlist) return notFound(res)(null)

    if (!(user.role === 'admin' || playlist.author_id.equals(user._id)))
        return res.status(403).end()

    const playlistBody = { films_id: [...new Set(films_id)], title: title }
    await Object.assign(playlist, playlistBody).save()

    return success(res)(playlist)
};

const partialUpdate = async ({ user, body, params }, res, next) => {

    const { title, films_id, is_public } = body;
    const isRemoveFilms = body.is_remove_films === true ? true : false

    if (title &&
        !(typeof title === 'string' || title instanceof String))
        return res.status(400).json({
            errors: "Path title must be of type String!"
        }).end();

    if (films_id && films_id.length > 0 &&
        !(films_id instanceof Array))
        return res.status(400).json({
            errors: "Path films must be of type Array!"
        }).end();

    let playlist = await Playlist.findById(params.id)

    if (!playlist) return notFound(res)(null)

    if (!(user.role === 'admin' || playlist.author_id.equals(user._id)))
        return res.status(403).end()

    let playlistBody = {}

    if (films_id) {
        for (let film_id of films_id) {
            if (!(mongoose.Types.ObjectId.isValid(film_id))) {
                return res.status(400).json({
                    errors: `Film with id ${film_id} is not ObjectID type`
                });
            }
        }

        const filmsIdBody = films_id.map(id => mongoose.Types.ObjectId(id));

        if (filmsIdBody && filmsIdBody.length > 0)
            if (isRemoveFilms)
                playlistBody = { ...playlistBody, "$pull": { "films_id": { $in: filmsIdBody } } }
            else
                playlistBody = { ...playlistBody, "$addToSet": { "films_id": filmsIdBody } }
    }

    if (is_public !== undefined) playlistBody = { ...playlistBody, is_public: is_public }

    if (title) playlistBody = { ...playlistBody, title: title }

    await Playlist.findOneAndUpdate({ _id: params.id },
        playlistBody, { new: true })
        .then(notFound(res))
        .then((playlist) => playlist.view(true))
        .then(success(res))
        .catch((err) => catchFilmNonExists(res, err, next));
};


const destroy = async ({ params, user }, res, next) => {
    let playlist = await Playlist
        .findOne({ _id: params.id })

    if (!playlist) return notFound(res)(null)

    if (!(user.role === 'admin' || playlist.author_id.equals(user._id)))
        return res.status(403).end()

    try {
        await playlist.remove()
        return success(res, 204)(null)
    } catch (err) {
        return next(err)
    }
}


const search = async ({ query }, res, next) => {

    const limit = parseInt(query.limit) || 10;
    const skip = parseInt(query.skip) || 0;

    let sort = {};

    if (query.sort_created_at) {
        const value = query.sort_created_at == 1 ? 1 : -1;
        sort = { ...sort, "createdAt": value }
    }

    if (query.sort_title) {
        const value = query.sort_title == 1 ? 1 : -1;
        sort = { ...sort, "title": value }
    }

    if (query.sort_text) {
        const value = query.sort_text == 1 ? 1 : -1;
        sort = { ...sort, "films_id": value }
    }

    let match = {};

    if (query.filter_date_start || query.filter_date_end) {

        let dateStartObject = moment(query.filter_date_start, "DD/MM/YYYY");
        let dateStart = dateStartObject.toDate();

        let dateEndObject = moment(query.filter_date_end, "DD/MM/YYYY");
        let dateEnd = dateEndObject.toDate();

        if (isNaN(dateStart.getTime())) {
            let message = query.filter_date_start ? { error: 'Bad dateStart format! Format must by DD/MM/YYYYY.' } : { error: 'Starting date cannot be empty!' };
            return res.status(400).send(message)
        }

        if (isNaN(dateEnd.getTime())) {
            if (query.filter_date_end)
                return res.status(400).send({ error: 'Bad dateEnd format! Format must by DD/MM/YYYYY.' });
            else dateEnd = moment().toDate()
        }

        match = {
            ...match,
            "createdAt": {
                "$gte": dateStart,
                "$lt": dateEnd
            }
        }
    }

    if (query.filter_title_starts)
        match = { ...match, "title": new RegExp("^" + query.filter_title_starts) }
    else if (query.filter_title)
        match = { ...match, "title": query.filter_title }

    Playlist.find(match)
        .skip(skip)
        .limit(limit)
        .sort(sort)
        .then((playlist) => playlist.map((playlist) => playlist.view(true)))
        .then(success(res))
        .catch(next);
}

module.exports = {
    create,
    index,
    showAll,
    update,
    partialUpdate,
    destroy,
    search,
}