const expect = require('chai').expect

const { parseErrors } = require('./helpers')
const ObjectId = require('mongoose').Types.ObjectId;

const createDatabase = require('./test_helper')
const User = require('../src/api/user/model').model
const UserController = require('../src/api/user/controller')


createDatabase({ before, afterEach, after }, () => {

  before(async () => {
    const user = new User({
      name: 'TestID',
      email: 'test@id.com',
      password: 'test123',
      _id: '60de34c15e7cd7402cebdd32'
    })
    return await user.save()
  })

  describe('user controller', () => {

    describe('CREATE user', () => {
      it('should create a new user', async () => {
        const req = {
          body: {
            name: 'Test',
            email: 'test@test.com',
            password: 'test123',
          }
        }

        const res = {
          statusCode: undefined,
          userData: undefined,
          status: function (code) {
            this.statusCode = code
            return this
          },
          json: function (data) {
            this.userData = data
            return this
          }
        }

        await UserController.create(req, res, () => { })

        expect(res).to.have.property('statusCode', 201)
        expect(res).to.have.property('userData').property('token')
      });

      it('should throw error with code 409 when trying to create user with existing email', async () => {
        const req = {
          body: {
            name: 'Test',
            email: 'test@test.com',
            password: 'test123',
          }
        }

        let error = {}
        const next = (err) => parseErrors(err, error)

        await UserController.create(req, {}, next)

        expect(error).to.have.property('status', 409)
        expect(error).to.have.property('message').property('error', 'Email already registered')
      });
      it('should throw error with code 422 when trying to create user with password of length < 6', async () => {
        const req = {
          body: {
            name: 'Test',
            email: 'new@test.com',
            password: 'test',
          }
        }

        let error = {}
        const next = (err) => parseErrors(err, error)


        await UserController.create(req, {}, next)

        expect(error).to.have.property('status', 422)
        expect(error).to.have.property('message').property('errors')
        expect(error.message.errors).to.be.instanceOf(Array)
        expect(error.message.errors).to.have.lengthOf(1)
      });
    })

    describe('GET user', () => {
      it('should get all users', async () => {
        const res = {
          statusCode: undefined,
          userData: undefined,
          status: function (code) {
            this.statusCode = code
            return this
          },
          json: function (data) {
            this.userData = data
            return this
          }
        }

        await UserController.all({}, res, () => { })

        expect(res.userData).to.be.instanceof(Array)
        expect(res.userData).to.have.lengthOf(2)
      })

      it('should get logged user details with created playlists, comments or films', async () => {
        const req = {
          user: {
            id: '60de34c15e7cd7402cebdd32'
          },
          query: {
            full: true
          }
        }
        const res = {
          statusCode: undefined,
          userData: undefined,
          status: function (code) {
            this.statusCode = code
            return this
          },
          json: function (data) {
            this.userData = data
            return this
          }
        }

        await UserController.me(req, res, () => { })

        expect(res.userData).to.be.instanceof(Object)
        expect(res.userData).to.have.property('id', '60de34c15e7cd7402cebdd32')
        expect(res.userData).to.have.property('name', 'TestID')
        expect(res.userData).to.have.property('comments').to.be.lengthOf(0)
        expect(res.userData).to.have.property('films').to.be.lengthOf(0)
        expect(res.userData).to.have.property('playlists').to.be.lengthOf(0)
      })


      it('should get logged user details wihout created playlists, comments and films', async () => {
        const req = {
          user: {
            id: '60de34c15e7cd7402cebdd32'
          },
          query: {
            full: false
          }
        }
        const res = {
          statusCode: undefined,
          userData: undefined,
          status: function (code) {
            this.statusCode = code
            return this
          },
          json: function (data) {
            this.userData = data
            return this
          }
        }

        await UserController.me(req, res, () => { })

        expect(res.statusCode).to.equal(200)

        expect(res.userData).to.be.instanceof(Object)
        expect(res.userData).to.have.property('id', '60de34c15e7cd7402cebdd32')
        expect(res.userData).to.not.have.property('comments')
        expect(res.userData).to.not.have.property('films')
        expect(res.userData).to.not.have.property('playlists')
      })

      it('should get user by id with created playlists, comments and films', async () => {
        const req = {
          params: {
            id: '60de34c15e7cd7402cebdd32'
          },
          query: {
            full: true
          }
        }

        const res = {
          statusCode: undefined,
          userData: undefined,
          status: function (code) {
            this.statusCode = code
            return this
          },
          json: function (data) {
            this.userData = data
            return this
          }
        }

        await UserController.index(req, res, () => { })

        expect(res.statusCode).to.equal(200)

        expect(res.userData).to.be.instanceof(Object)
        expect(res.userData).to.have.property('id', '60de34c15e7cd7402cebdd32')

        expect(res.userData).to.have.property('name', 'TestID')
        expect(res.userData).to.have.property('comments').to.be.lengthOf(0)
        expect(res.userData).to.have.property('films').to.be.lengthOf(0)
        expect(res.userData).to.have.property('playlists').to.be.lengthOf(0)
      })

      it('should get user by id without created playlists, comments and films', async () => {
        const req = {
          params: {
            id: '60de34c15e7cd7402cebdd32'
          },
          query: {
            full: false
          }
        }

        const res = {
          statusCode: undefined,
          userData: undefined,
          status: function (code) {
            this.statusCode = code
            return this
          },
          json: function (data) {
            this.userData = data
            return this
          }
        }

        await UserController.index(req, res, () => { })

        expect(res.statusCode).to.equal(200)

        expect(res.userData).to.be.instanceof(Object)
        expect(res.userData).to.have.property('id', '60de34c15e7cd7402cebdd32')

        expect(res.userData).to.have.property('name', 'TestID')
      })

      it('should get user by id - the same as logged user - with created playlists, comments and films', async () => {
        const req = {
          user: {
            id: '60de34c15e7cd7402cebdd32'
          },
          params: {
            id: '60de34c15e7cd7402cebdd32'
          },
          query: {
            full: true
          }
        }

        const res = {
          statusCode: undefined,
          userData: undefined,
          status: function (code) {
            this.statusCode = code
            return this
          },
          json: function (data) {
            this.userData = data
            return this
          }
        }

        await UserController.index(req, res, () => { })

        expect(res.statusCode).to.equal(200)

        expect(res.userData).to.be.instanceof(Object)
        expect(res.userData).to.have.property('id', '60de34c15e7cd7402cebdd32')

        expect(res.userData).to.have.property('name', 'TestID')
      })

      it('should throw an error with code 404 when trying to get non existing user', async () => {
        const req = {
          params: {
            id: '61de34c15e7cd7402cebdd32'
          },
          query: {
            full: false
          }
        }

        const res = {
          statusCode: undefined,
          status: function (code) {
            this.statusCode = code
            return this
          },
          end: function () {
            return this
          }
        }

        await UserController.index(req, res, () => { })

        expect(res).to.have.property('statusCode', 404)

      })
    })

    describe('UPDATE user', () => {
      it('should update user name', async () => {
        
        const req = {
          user: {
            id: '60de34c15e7cd7402cebdd32'
          },
          body: {
            name: 'NewTestID',
            email: 'test@id.com' // same email as it is now, no change
          }
        }

        const res = {
          statusCode: undefined,
          userData: undefined,
          status: function (code) {
            this.statusCode = code
            return this
          },
          json: function (data) {
            this.userData = data
            return this
          }
        }

        await UserController.update(req, res, () => { })

        expect(res.userData).to.be.instanceof(Object)

        expect(res.userData).to.have.property('name', 'NewTestID')
        expect(res.userData).to.have.property('email', 'test@id.com')
        expect(res.userData).to.have.property('role', 'user')

      })

      it('should throw an error with code 404 when trying to update user that dose not exists', async () => {
        const req = {
          user: {
            id: '63dc34c15e7cd7402cebdd32'
          }
        }

        const res = {
          statusCode: undefined,
          userData: undefined,
          status: function (code) {
            this.statusCode = code
            return this
          },
          end: function () { return this }
        }

        await UserController.update(req, res, () => {})

        expect(res).to.have.property('statusCode', 404)
      })
      it('should throw an error with code 409 when trying to change current user email to one that is in use by another user', async () => {
        const req = {
          user: {
            id: '60de34c15e7cd7402cebdd32'
          },
          body: {
            email: 'test@test.com'
          }
        }

        let error = {}
        const next = (err) => parseErrors(err, error)

        await UserController.update(req, {}, next)

        expect(error).to.have.property('status', 409)
        expect(error).to.have.property('message').property('error', 'Email already registered')
      })

    })

    describe('DELETE user', () => {
      it('should remove logged_in user', async () => {
        
        const req = {
          user: {
            id: '60de34c15e7cd7402cebdd32'
          }
        }

        const res = {
          statusCode: undefined,
          userData: undefined,
          status: function (code) {
            this.statusCode = code
            return this
          },
          end: function () { return this }
        }

        await UserController.destroy(req, res, () => {})

        expect(res).to.have.property('statusCode', 204)
      })

      it('should throw an error wtih code 500 when trying to remove a user with bad formatted id', async () => {
        const req = {
          user: {
            id: '2'
          }
        }
       
        let error = {}
        const next = (err) => parseErrors(err, error)

        await UserController.destroy(req, {}, next)

        expect(error).to.have.property('status', 500)
      })
    })

  });
});