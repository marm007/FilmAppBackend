const {Router} = require('express');
const {
    create, index, showAll, update, partialUpdate, destroy, search
} = require('./controller');

const {token} = require('../../services/passport');
const router = new Router();

const {Schema} = require('mongoose');

const bodymen = require("bodymen");

const {errorHandler} = require("bodymen");

router.post('/',
    token({required: true}),
    create);

router.get('/:id',
    index);

router.get('/',
    showAll);

router.put('/:id',
    update);

router.patch('/:id',
    partialUpdate);

router.delete('/:id',
    token({required: true}),
    destroy);

router.get('/search',
    search);

module.exports = router;
