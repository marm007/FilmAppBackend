const mongoose = require('mongoose');

const {success, notFound} = require('../../services/response/');

const catchFilmNonExists = require('./helper').catchFilmNonExists;

const Playlist = require('./model').model;

const create = async ({user, body}, res, next) => {

    let {films_id, title, is_public} = body;
    
    if(is_public === undefined) is_public = true
    else {
        if (!(typeof is_public === 'boolean' || is_public instanceof Boolean)) 
            return res.status(400).send({error: 'Is public must be either true or false!'})
    }

    films_id = [...new Set(films_id)];
    
    const playlistBody = {is_public: is_public, films_id: films_id, 
        title: title, author_id: user._id, author_name: user.name}

    await Playlist.create(playlistBody)
        .then(playlist => playlist[0].view(true))
        .then(success(res, 201))
        .catch(next);
};

const index = ({params}, res, next) =>
    Playlist.findById(params.id)
        .populate({path: 'films_id', select: 'thumbnail -_id'})
        .then(notFound(res))
        .then(playlist => playlist ? playlist.view() : null)
        .then(success(res))
        .catch(next);

const showAll = (req, res, next) => {

    const user = req.user

    const limit = parseInt(req.query.limit) || 10;
    const skip = parseInt(req.query.skip) || 0;
    const is_add = req.query.is_add === true ? true : false

    let filter = user ? {$or:[ {'author_id': user._id}, {'is_public': true}]} :  {'is_public': true}
    filter = {...filter, films_id: {$exists: true, $ne: []}}
    
    if(is_add && user)
        Playlist.find({author_id: user._id}, '_id title is_public')
            .then(playlists => playlists.map(playlist => playlist.view()))
            .then(success(res))
            .catch(next)
    else 
        Playlist.find(filter)
            .populate({path: 'films_id',  $exists: true, select: 'thumbnail', perDocumentLimit: 1})
            .skip(skip)
            .limit(limit)
            .then(playlists => {
                playlists = playlists.filter(playlist => playlist.films_id[0])
                return playlists.map(playlist => {
                    playlist = playlist.view(true)
                    playlist.thumbnail = playlist.films_id[0].thumbnail
                    delete playlist.films_id
                    return playlist
                })
            })
            .then(success(res))
            .catch(next)
    
}


const update = async ({user, body, params}, res, next) => {

    const {title, films_id} = body;
    
    if (title === undefined || title === null)
        return res.status(400).json({
            errors:
                "Title is required!"
        }).end();

    if (!(typeof title === 'string' || title instanceof String))
        return res.status(400).json({
            errors:
                "Path title must be of type String!"
        }).end();

    if (films_id === undefined || films_id === null || films_id.length === 0)
        return res.status(400).json({
            errors:
                "Path films array is required!"
        }).end();

    if (!(films_id instanceof Array))
        return res.status(400).json({
            errors:
                "Path films must be of type Array!"
        }).end();

    
    let playlist = Playlist.findById(params.id)
        .then((playlist) => playlist ? playlist.view(true) : null)

    if(!playlist) return notFound(res)(null)

    if (!(user.role === 'admin' || playlist.author_id.equals(user._id))) 
        return res.status(403).send({error: 'You are forbidden to perform this action!'})
    
    const playlistBody = {films_id: [...new Set(films_id)], title: title}
    await Object.assign(playlist, playlistBody).save()

    return success(res)(playlist)
};

const partialUpdate = async ({user, body, params}, res, next) => {

    const {title, films_id} = body;
    const isRemoveFilms = body.is_remove_films === true ? true : false

    if (title && 
        !(typeof title === 'string' || title instanceof String))
            return res.status(400).json({
                errors:
                    "Path title must be of type String!"
            }).end();
   
    if (films_id && films_id.length > 0 && 
        !(films_id instanceof Array))
            return res.status(400).json({
                errors:
                    "Path films must be of type Array!"
            }).end();

    let playlist = Playlist.findById(params.id)
            .then((playlist) => playlist ? playlist.view(true) : null)

    if(!playlist) return notFound(res)(null)

    if (!(user.role === 'admin' || playlist.author_id.equals(user._id))) 
        return res.status(403).end()

    for (let film_id of films_id) {
        if (!(mongoose.Types.ObjectId.isValid(film_id))) {
            return res.status(400).json({
                errors: `Film with id ${film_id} is not ObjectID type`
            });
        }
    }

    const filmsIdBody = films_id.map(id => mongoose.Types.ObjectId(id));

    let playlistBody = {}

    if(filmsIdBody && filmsIdBody.length > 0) 
        if(isRemoveFilms)
            playlistBody = {...playlistBody, "$addToSet": {"films_id": filmsIdBody}}
        else
            playlistBody = {...playlistBody, "$pull": {"films_id": {$in: filmsIdBody}}} 

    if(title) playlistBody = {...playlistBody, title: title}

    Playlist.findOneAndUpdate({_id: params.id},
         playlistBody, {new: true})
        .then(notFound(res))
        .then((playlist) => playlist.view(true))
        .then(success(res))
        .catch((err) => catchFilmNonExists(res, err, next));
};


const destroy = async ({id}, res, next) => 
    Playlist
        .findOneAndDelete({_id: id})
        .then(notFound(res))
        .then(success(res, 204))
        .catch(next)
   

const search = async({query}, res, next) => {
    
    const limit = parseInt(query.limit) || 10;
    const skip = parseInt(query.skip) || 0;

    let sort = {};

    if (query.sort_created_at) {
        const value = query.sort_created_at == 1 ? 1 : -1;
        sort = {...sort, "createdAt": value}
    }

    if (query.sort_title) {
        const value = query.sort_title == 1 ? 1 : -1;
        sort = {...sort, "title": value}
    }

    if (query.sort_text) {
        const value = query.sort_text == 1 ? 1 : -1;
        sort = {...sort, "films_id": value}
    }

    let match = {};

    if (query.filter_date_start || query.filter_date_end) {

        let dateStartObject = moment(query.filter_date_start, "DD/MM/YYYY");
        let dateStart = dateStartObject.toDate();

        let dateEndObject = moment(query.filter_date_end, "DD/MM/YYYY");
        let dateEnd = dateEndObject.toDate();

        if (isNaN(dateStart.getTime())) {
            let message = query.filter_date_start ?
                {error: 'Bad dateStart format! Format must by DD/MM/YYYYY.'} : {error: 'Starting date cannot be empty!'};
            return res.status(400).send(message)
        }

        if (isNaN(dateEnd.getTime())) {
            if (query.filter_date_end)
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

    if (query.filter_title_starts) 
        match = {...match, "title": new RegExp("^" + query.filter_title_starts)}
    else if(query.filter_title) 
        match = {...match, "title": query.filter_title}

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
