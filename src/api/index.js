const {Router} = require('express');

const auth = require('./auth')
const film = require('./film');
const user = require('./user');
const playlist = require('./playlist');
const comment = require('./comment')

const _ = require('lodash');

const router = new Router();

router.use('/auth', auth)
router.use('/users', user);
router.use('/films', film);
router.use('/playlists', playlist);
router.use('/comments', comment);

router.use(function (req, res, next) {
    res.status(404).send({errors: ['Routing not found']});
});


router.use(function (err, req, res, next) {
    if (err.name === 'ValidationError') {
        const errors = _.map(err.errors, function (v) {
            return v.message;
        });

        return res.status(404).send({errors});
    }
    console.log("zxczxczx")

    res.status(500).send({errors: ['Application error']});
});


module.exports = router;
