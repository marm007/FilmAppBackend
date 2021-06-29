const {Router} = require('express');
const {token} = require('../../services/passport');
const {all, me, index, create, update, destroy, updateMeta, listMinePlaylists, listMineFilms} = require("./controller");

const router = new Router();

router.get('/',
    token({required: true, roles: ['admin']}),
    all);

router.get('/me',
    token({required: true}),
    me);

router.get('/me/playlists',
    token({required: true}),
    listMinePlaylists);

router.get('/me/films',
    token({required: true}),
    listMineFilms);

router.get('/:id',
    //token({required: true, roles: ['admin']}),
    index);

router.post('/',
    create);


router.put('/',
    token({required: true}),
    update);

router.put('/update/meta',
    token({required: true}),
    updateMeta);

router.delete('/:id',
    token({required: true, roles: ['admin']}),
    destroy);



module.exports = router;
