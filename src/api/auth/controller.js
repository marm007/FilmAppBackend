const async = require('async');
const mongoose = require('mongoose')
const crypto = require('crypto');
const sendmail = require('../../services/email');
const { frontendUri } = require('../../config');

const { success, notFound } = require('../../services/response');
const { sign } = require('../../services/jwt');

const User = require('../user/model').model;
const UserDetails = require('../user/detailsModel').model;
const RefreshToken = require('./refreshTokenModel').model;

const auth = async (req, res, next) => {
    const { user } = req;

    const accessToken = await sign(user)

    if (accessToken) {
        try {
            const refreshToken = await RefreshToken.create({
                user: user._id,
                token: crypto.randomBytes(40).toString('hex'),
                expires: new Date(Date.now() + 24 * 60 * 60 * 1000), 
            }) // expires in 1 day
            return success(res, 200)({ token: accessToken, refreshToken: refreshToken.token, user: user.view(true) })
        } catch (err) {
            return next(err)
        }
    } else {
        return res.status(500).json({ error: 'Something went wrong!' })
    }

};

const refresh = async (req, res, next) => {
    const { refreshToken } = req.body
    const { user } = req

    const tokenObject = await RefreshToken.findOne({token: refreshToken, user: user._id})

    if(!tokenObject) return notFound(res)(null)

    if(tokenObject.isExpired) return res.status(401).json({error: 'Refresh token has expired! Please login again.'}).end()

    const accessToken = await sign(user)

    return success(res, 201)({ token: accessToken })
}

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

                User.findOne({ email: req.body.email }).then(user => {
                    if (!user)
                        return res.status(404).json({ errors: 'No account with that email address exists.' }).end();

                    UserDetails.findOne({ user_id: user._id }).then(details => {
                        let expires = Date.now() + 3600000
                        details.reset_password = { token: token, expires: expires }
                        details.save(function (err) {
                            done(err, token, user);
                        });
                    })
                })
            },
            function (token, user, done) {

                const content = 'Change password link:\n\n' +
                    `${frontendUri}reset/` + token + '\n\n';

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
                'reset_password.expires': { $gt: Date.now() }
            }).then(details => {
                if (!details) {
                    return res.status(401).json({
                        errors: ['Reset password token has expired.']
                    }).end();
                }

                User.findOne({ _id: details.user_id }).then(user => {
                    user.password = req.body.password;
                    if (user.password === undefined || user.password === null || user.password === "")
                        return res.status(404).json({
                            errors: ['Path password is required.']
                        }).end();

                    details.reset_password = { token: undefined, expires: undefined }
                    details.save()
                    user.save(function (err) {
                        sign(user)
                            .then((token) => ({ token, user: user.view(true) }))
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

module.exports = { auth, forgot, reset, refresh };
