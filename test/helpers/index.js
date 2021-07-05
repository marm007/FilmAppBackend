const _ = require('lodash');

const parseErrors = (err, error) => {
    if (err.name === 'ValidationError') {
      const errors = _.map(err.errors, function (v) {
        return v.message;
      });     
      error.status = 422
      error.message = {errors}
    } else if(err.name === 'MongoError' && err.code === 11000) {      
      error.status = 409
      error.message = { error: 'Email already registered' }
    } else {      
      error.status = 500
      error.message = {error: 'Application error'}
    }

    return error
}

module.exports = { parseErrors }