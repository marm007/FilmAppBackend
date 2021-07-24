const { Router } = require('express');
const {
    create,
    index,
    getAll,
    getVideo,
    showThumbnail,
    update,
    partialUpdate,
    view,
    like,
    destroy,
    search
}
    = require('./controller');

const {
    createComment, getAllComments, sortComments, filterComments
} = require('../comment/controller');

const { token } = require('../../services/passport');
const router = new Router();

router.post('/',
    token({ required: true }),
    create);

router.get('/',
    getAll);

router.get('/search',
    search);

router.get('/:id',
    index);

router.get('/:id/video',
    getVideo);

router.get('/:id/thumbnail',
    showThumbnail);

router.put('/:id',
    token({ required: true }),
    update);

router.patch('/:id',
    token({ required: true }),
    partialUpdate);

router.patch('/:id/view',
    view);

router.patch('/:id/:action',
    token({ required: true }),
    like);

router.delete('/:film_id',
    token({ required: true }),
    destroy);

router.post('/:film_id/comments',
    token({ required: true }),
    createComment);

router.get('/:film_id/comments',
    token({ required: false }),
    getAllComments);

router.get('/:film_id/comments/sort',
    sortComments);

router.get('/:film_id/comments/filter',
    filterComments);


module.exports = router;
