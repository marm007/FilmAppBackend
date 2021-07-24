const { Router } = require('express');
const {
    create,
    index,
    showAll,
    update,
    partialUpdate,
    destroy,
    search
} = require('./controller');

const { token } = require('../../services/passport');
const router = new Router();

const { Schema } = require('mongoose');

const bodymen = require("bodymen");

const { errorHandler } = require("bodymen");

router.post('/',
    token({ required: true }),
    create);

router.get('/:id',
    token({ required: false }),
    index);

router.get('/',
    token({ required: false }),
    showAll);

router.put('/:id',
    token({ required: true }),
    update);

router.patch('/:id',
    token({ required: true }),
    partialUpdate);

router.delete('/:id',
    token({ required: true }),
    destroy);

router.get('/search',
    search);

module.exports = router;