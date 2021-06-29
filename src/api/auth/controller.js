const async = require('async');
const crypto = require('crypto');
const sendmail = require('../../services/email');

const {success} = require('../../services/response');
const {sign} = require('../../services/jwt');

const User = require('../user/model').model;

const auth = (req, res, next) => {

    const {user} = req;

    sign(user)
        .then((token) => ({token, user: user.view(true)}))
        .then(success(res, 201))
        .catch(next);
};


const forgot =
    function (req, res, next) {
        async.waterfall([

            function (done) {
                crypto.randomBytes(20, function (err, buf) {
                    let token = buf.toString('hex');
                    done(err, token);
                });

            },
            function (token, done) {

                User.findOne({email: req.body.email}, function (err, user) {
                    if (!user) {
                        return res.status(404).json({errors: 'No account with that email address exists.'}).end();
                    }

                    user.resetPasswordToken = token;
                    user.resetPasswordExpires = Date.now() + 3600000;

                    user.save(function (err) {
                        done(err, token, user);
                    });
                });

            },
            function (token, user, done) {

                const content = 'Change password link:\n\n' +
                    `https://marm007.github.io/filmapp_frontend/reset/` + token + '\n\n';

                sendmail(user.email, 'Reset password!', content, function (err) {
                    done(err, 'done');
                });
            }
        ], function (err) {
            if (err) return next(err);
            return res.status(200).end();
        });
    };


const reset = function (req, res, next) {
    async.waterfall([
        function (done) {

            User.findOne({
                resetPasswordToken: req.params.token,
                resetPasswordExpires: {$gt: Date.now()}
            }, function (err, user) {
                if (!user) {
                    return res.status(401).json({
                        errors: ['Reset password token has expired.']
                    }).end();
                }

                user.password = req.body.password;

                if (user.password === undefined || user.password === null || user.password === "")
                    return res.status(404).json({
                        errors: ['Path password is required.']
                    }).end();

                user.resetPasswordToken = undefined;
                user.resetPasswordExpires = undefined;

                user.save(function (err) {
                    sign(user)
                        .then((token) => ({token, user: user.view(true)}))
                        .then(done(err, user))
                });
            });

        },
        function (user, done) {

            const content = 'Hello,\n\n' +
                'Password for your account ' + user.email + ' has just been changed.\n';

            sendmail(user.email, 'Your password has been changed', content, function (err) {
                done(err);
            });
        }
    ], function (err) {

        if (err) return next(err);

        return res.status(200).end();
    });
};

module.exports = { auth, forgot, reset };
