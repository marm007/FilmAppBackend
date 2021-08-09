const { Router } = require('express');
const { token } = require('../../services/passport');
const { all, me, index, create, update, partialUpdate, destroy } = require("./controller");

const router = new Router();

router.get('/',
    token({ required: true, roles: ['admin'] }),
    all);

router.get('/me',
    token({ required: true }),
    me);

router.get('/:id',
    //token({required: true, roles: ['admin']}),
    index);

router.post('/',
    create);

router.put('/',
    token({ required: true }),
    update);

router.patch('/',
    token({ required: true }),
    partialUpdate)

router.delete('/',
    token({ required: true }),
    destroy);



module.exports = router;
