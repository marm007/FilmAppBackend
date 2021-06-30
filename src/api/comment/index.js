const {Router} = require('express')

const {index, update, destroy} = require('./controller')

const router = new Router()
const {token} = require('../../services/passport');

router.get('/:comment_id',
    index);


router.put('/:comment_id',
    token({required: true}),
    update);

router.delete('/:comment_id',
    token({required: true}),
    destroy);


module.exports = router