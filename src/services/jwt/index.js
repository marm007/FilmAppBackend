const jwt = require('jsonwebtoken');
const {jwtSecret} = require('../../config');
const util = require('util');

const jwtSign = util.promisify(jwt.sign);
const jwtVerify = util.promisify(jwt.verify);

const sign = (user, options, method = jwtSign) => {

    const {id, role, name} = user;
    const payload = {id, role, name};

    return method(payload, jwtSecret, options);
};


module.exports = {

    sign

};