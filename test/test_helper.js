const mongoose = require('mongoose');
const {mongo} = require('../src/config');

const connect = async () => {
  await close();
  
  await mongoose.connect(mongo.uri, {
    // Mongoose options
  });
};

const clear = async () => {
  await mongoose.connection.dropDatabase();
};

const close = async () => {
  await mongoose.connection.close();
};

module.exports = async ({before, afterEach, after}, callback) => {
  await before(async () => await connect());
  await after(async () => await clear());
  await after(async () => await close());
  await callback();
}