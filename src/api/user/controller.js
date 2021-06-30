const {success, notFound} = require('../../services/response');
const {sign} = require('../../services/jwt');
const catchDuplicateEmail = require("./helpers").catchDuplicateEmail;


const User = require('./model').model;
const Playlist = require('../playlist/model').model;
const Film = require('../film/model').model;


const create = ({body}, res, next) => {
    User.create(body)
        .then(user => {
            sign(user)
                .then((token) => ({token, user: user.view(true)}))
                .then(success(res, 201))
        })
        .catch((err) => catchDuplicateEmail(res, err, next));
};

const all = (req, res, next) =>
    User.find()
        .then((users) => users.map((user) => user.view(true)))
        .then(success(res))
        .catch(next);

const index = ({params}, res, next) =>
    User.findById(params.id)
        .then(notFound(res))
        .then((user) => user ? user.view(false) : null)
        .then(success(res))
        .catch(next);

const me = ({user}, res) =>
    res.json(user.view(true));

const listMinePlaylists =  ({user}, res, next) => {
    let playlists = user.playlists;

    const requests = [];

    playlists.map(playlist => {
        requests.push(
            Playlist.findById(playlist)
                .populate('films')
                .then(res => {
                    let resultFilms = res.films.map(a => a._id);
                    return {
                        id: playlist,
                        title: res.title,
                        films: resultFilms,
                        film_id: (res.films[0] !== null && res.films.length !== 0) ? res.films[0]._id : null,
                        thumbnail: (res.films[0] !== null && res.films.length !== 0) ? res.films[0].thumbnail._id : null,
                        createdAt: res.createdAt
                    }
                })
        );
    });

    Promise.all(requests)
        .then(success(res))
        .catch(next => {
            console.log(next)
        });

};

const listMineFilms = ({user, query}, res, next) => {
    let films = user.films;

    let start = query.start ? query.start : 0;
    let limit = query.limit ? (query.limit >= films.length ? films.length - 1 : query.limit)
        : films.length - 1;

    const requests = [];

    films.forEach(film => {
        requests.push(
            Film.findById(film)
                .then(notFound(res))
                .then(res => {
                    return {
                        id: film,
                        title: res.title,
                        thumbnail: res.thumbnail,
                        views: res.meta.views,
                        createdAt: res.createdAt,
                    }
                })
                .catch(next)
        );
    });

    Promise.all(requests)
        .then(success(res))
        .catch(next);

};


const update = ({body, user}, res, next) =>
    User.findById(user.id)
        .then(notFound(res))
        .then((user) => user ? Object.assign(user, body).save() : null)
        .then((user) => user ? user.view(true) : null)
        .then(success(res))
        .catch((err) => catchDuplicateEmail(res, err, next));


const destroy = ({params}, res, next) =>
    User.findById(params.id)
        .then(notFound(res))
        .then((user) => user ? user.remove() : null)
        .then(success(res, 204))
        .catch(next);


const updateMeta = async (req, res, next) => {

    const user = req.user;
    const {body} = req;

    let likes = 0;
    let dislikes = 0;

    if (!Object.keys(body).length)
        return res.status(400).json({
            errors: '`body` cannot be empty'
        }).end();

    if (!user) {
        return res.status(401).json({
            errors: 'unauthorized'
        }).end()
    }

    if (body.disliked) {

        if (user.meta.disliked.indexOf(body.disliked) <= -1) {
            user.meta.disliked.push(body.disliked)
            dislikes = 1;
            if (user.meta.liked.indexOf(body.disliked) > -1) {
                user.meta.liked.splice(user.meta.liked.indexOf(body.disliked), 1);
                likes = -1;
            }
        } else {
            return res.status(400).json({
                errors: 'film already disliked'
            }).end();
        }
    }

    if (body.liked) {
        if (user.meta.liked.indexOf(body.liked) <= -1) {
            user.meta.liked.push(body.liked);
            likes = 1;
            if (user.meta.disliked.indexOf(body.liked) > -1) {
                user.meta.disliked.splice(user.meta.disliked.indexOf(body.liked), 1);
                dislikes = -1;
            }
        } else {
            return res.status(400).json({
                errors: 'film already liked'
            }).end();
        }
    }


    {
        await user.save();
        success(res)({likes: likes, dislikes: dislikes})
    }

};

module.exports = {
    create,all, index, update, destroy, me, updateMeta, listMinePlaylists, listMineFilms
};
