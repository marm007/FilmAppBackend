const {Router} = require('express');
const {
    create,
    index,
    getAll,
    getAllOnlyTitle,
    getVideo,
    showThumbnail,
    update,
    partialUpdate,
    updateMeta,
    destroy,
    search
}
    = require('./controller');

const {
    createComment, indexComment, getAllComments, destroyComment, updateComment, sortComments, filterComments
} = require('../comment/controller');

const {token} = require('../../services/passport');
const router = new Router();

router.post('/',
    token({required: true}),
    create);

router.get('/',
    getAll);

router.get('/titles',
    getAllOnlyTitle);

router.get('/search',
    search);

router.get('/:id',
    index);

router.get('/:id/video',
    getVideo);

router.get('/:film_id/thumbnail',
    showThumbnail);

router.put('/:id',
    token({required: true}),
    update);

router.patch('/:id',
    token({required: true}),
    partialUpdate);

router.put('/:id/meta',
    updateMeta);

router.delete('/:film_id',
    token({required: true}),
    destroy);

router.post('/:film_id/comments',
    token({required: true}),
    createComment);

router.get('/:film_id/comments/:commentId',
    indexComment);

router.get('/:film_id/comments',
    getAllComments);

router.get('/:film_id/comments/sort',
    sortComments);

router.get('/:film_id/comments/filter',
    filterComments);

router.put('/:film_id/comments/:commentId',
    token({required: true}),
    updateComment);

router.delete('/:film_id/comments/:commentId',
    token({required: true}),
    destroyComment);


module.exports = router;
