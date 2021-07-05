const path = require('path');
const merge = require('lodash/merge');
//
const config = {
    all: {
        env: process.env.NODE_ENV || 'development',
        root: path.join(__dirname, '..'),
        port: 9000,
        ip: 'localhost',
        apiRoot: '/api',
        uploadDirectory: 'upload',
        frontendUri: 'localhost:9000/reset',
        mongo: {
            options: {
                useCreateIndex: true,
                useNewUrlParser: true,
                useFindAndModify: false
            }
        },
        mail: {
            auth: {
                user: 'roel.cormier87@ethereal.email',
                pass: 'pZrUaZryyZS8WWTZdm'
            }
        }

    },
    test: {
        mongo: {
            uri: 'mongodb+srv://TestUser:435DkTppNBfoWEmm@filmappcluset-tuxyg.mongodb.net/filmapp-test?retryWrites=true',
            options: {
                debug: true,
            }
        },
        jwtSecret: '4rrfdutpOntGGOVYLdG6hiOQf4v7dY'
    },
    development: {
        mongo: {
            uri: 'mongodb+srv://DevUser:QL6DNcQ7G90R1FkO@filmappcluset-tuxyg.mongodb.net/filmapp-dev?retryWrites=true',
            options: {
                debug: true,
            }
        },
        jwtSecret: '48mXwHcnH8qEwWgzo24y5BEIxgAU0a'
    },
    production: {
        ip: '0.0.0.0',
        port: process.env.PORT || 8080,
        frontendUri: process.env.FRONETEND_URI,
        mongo: {
            uri: process.env.MONGO_URI,
        },
        jwtSecret: process.env.SECRET,
        mail: {
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        }
    }


};

module.exports = merge(config.all, config[config.all.env]);
