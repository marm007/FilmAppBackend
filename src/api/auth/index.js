const { Router } = require('express');

const { password } = require('../../services/passport');
const { auth, forgot, reset } = require('./controller');

const router = new Router();

router.post('/',
    password(),
    auth);
router.post('/password/forgot', forgot);

router.post('/password/reset/:token', reset);

module.exports = router;
