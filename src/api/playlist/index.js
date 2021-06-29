const {Router} = require('express');
const {
    create, index, showAll, showAllAndFilterEmpty, updateTitle, insertFilms, destroy, showAllSortByCreationDate, showAllSortByTitle, showAllSortByFilmsSize,
    filterByTitle, filterByTitleStartsWith, filterByDateBetween, deleteFilms
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

router.get('/all',
    showAllAndFilterEmpty);

router.put('/:id',
    updateTitle);

router.put('/:id/films',
    insertFilms);

router.put('/:id/films/delete', token({required: true}),
    deleteFilms);


router.delete('/:id',
    token({required: true}),
    destroy);


router.get('/sort/date/:dir',
    showAllSortByCreationDate);

router.get('/sort/title:dir',
    showAllSortByTitle);

router.get('/sort/films:dir',
    showAllSortByFilmsSize);


router.get('/filter/title/:title',
    filterByTitle);

router.get('/filter/title/start/:start',
    filterByTitleStartsWith);

router.get('/filter/date/:date',
    filterByDateBetween);

module.exports = router;
