const { Router } = require('express');

const { password, tokenRefresh } = require('../../services/passport');
const { auth, forgot, reset, refresh } = require('./controller');

const router = new Router();

router.post('/',
    password(),
    auth);

router.post('/refresh',
    tokenRefresh(),
    refresh);

router.post('/password/forgot', forgot);

router.post('/password/reset/:token', reset);

module.exports = router;
