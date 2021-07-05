const async = require('async');
const crypto = require('crypto');
const sendmail = require('../../services/email');
const {frontendUri} = require('../../config');

const {success} = require('../../services/response');
const {sign} = require('../../services/jwt');

const User = require('../user/model').model;
const UserDetails = require('../user/detailsModel').model;

const auth = (req, res, next) => {

    const {user} = req;

    sign(user)
        .then((token) => ({token, user: user.view(true)}))
        .then(success(res, 200))
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

                User.findOne({email: req.body.email}).then(user => {
                    if (!user) 
                        return res.status(404).json({errors: 'No account with that email address exists.'}).end();

                    UserDetails.findOne({user_id: user._id}).then(details => {
                        let expires = Date.now() + 3600000
                        details.reset_password = {token: token, expires: expires}
                        details.save(function (err) {
                            done(err, token, user);
                        });
                    })
                })
            },
            function (token, user, done) {

                const content = 'Change password link:\n\n' +
                    `${frontendUri}` + token + '\n\n';

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
            UserDetails.findOne({
                    'reset_password.token': req.params.token,
                    'reset_password.expires': {$gt: Date.now()}
                }).then(details => {
                    if (!details) {
                        return res.status(401).json({
                            errors: ['Reset password token has expired.']
                        }).end();
                    }

                    User.findOne({_id: details.user_id}).then(user => {
                        user.password = req.body.password;
                        if (user.password === undefined || user.password === null || user.password === "")
                            return res.status(404).json({
                                errors: ['Path password is required.']
                            }).end();
                        
                        details.reset_password = {token: undefined, expires: undefined}
                        details.save()
                        user.save(function (err) {
                            sign(user)
                                .then((token) => ({token, user: user.view(true)}))
                                .then(done(err, user))
                        });
                    })
                })
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
