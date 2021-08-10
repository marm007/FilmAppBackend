const async = require('async');
const FSBucket = require('../../services/gridfs');
const mongoose = require('../../services/mongoose')

const { success, notFound } = require('../../services/response/');

const Film = require('./model').model;
const FilmDetail = require('./detailsModel').model;

const UserDetails = require('../user/detailsModel').model;
const Comment = require('../comment/model').model;

const handleGridFsUpload = require('./upload-db');

const ObjectId = require('mongoose').Types.ObjectId;

const sharp = require('sharp');

const unlinkGridFs = async (film_id, ...thumbnailIds) => {

    const FilmGridFs = require('./gridfs');
    const ThumbnailGridFs = require('../thumbnail/gridfs');

    if (film_id) await FilmGridFs.unlink({ _id: film_id }, (err, doc) => { });

    for (let id of thumbnailIds) {
        if (!id) continue;
        await ThumbnailGridFs.unlink({ _id: id }, (err, doc) => { });
    }
};

const create = async (req, res, next) => {

    handleGridFsUpload(req, res, async (err) => {

        const user = req.user;

        if (err) return res.status(404).send({ error: err.message });

        if (!req.files || !req.files.thumbnail || !req.files.film) return res.status(404).send({ error: 'Film or thumbnail not found' });

        if (!req.body.title || req.body.title === '') {
            await unlinkGridFs(req.files.film[0].id, req.files.thumbnail[0].id);
            return res.status(400).send({ error: `Path title is required!` })
        }

        if (!req.body.description || req.body.description === '') {
            await unlinkGridFs(req.files.film[0].id, req.files.thumbnail[0].id);
            return res.status(400).send({ error: `Path description is required!` })
        }


        const ThumbnailGridFs = require('../thumbnail/gridfs');

        let thumbnail = await ThumbnailGridFs.findById({ _id: req.files.thumbnail[0].id });

        if (!thumbnail) return res.status(404).send({ error: 'Thumbnail dose not exists!' });

        const [originalName, mime] = thumbnail.metadata.originalname.split('.');
        let filmStream = await ThumbnailGridFs.read({ filename: thumbnail.filename });

        let buffer = [];

        await filmStream.on('data', function (chunk) {
            buffer.push(chunk);
        });

        await filmStream.on('end', async function () {
            let all = new Buffer.concat(buffer);

            const previewName = originalName + Date.now() + '_preview.' + mime;
            const fileName = originalName + Date.now() + '_thumbnail.' + mime;
            const posterName = originalName + Date.now() + '_poster.' + mime;


            let thumbnailBody = {
                _id: req.files.thumbnail[0].id,
            };

            const previewBuffer = await sharp(all)
                .resize(25, Math.round(25 * 9 / 16))
                .toBuffer();

            const smallBuffer = await sharp(all)
                .resize(250, Math.round(250 * 9 / 16))
                .toBuffer();

            const posterBuffer = await sharp(all)
                .resize(500, Math.round(500 * 9 / 16))
                .toBuffer();

            if (!previewBuffer || !smallBuffer || !posterBuffer) {
                return res.status(400).send({ error: 'Bad request!' })
            }

            let stream = require('stream');

            async.waterfall([
                function (done) {
                    let bufferStream = new stream.PassThrough();
                    bufferStream.end(previewBuffer);
                    ThumbnailGridFs.write({
                        filename: previewName,
                        contentType: thumbnail.contentType
                    }, bufferStream, (error, file) => {
                        thumbnailBody.preview = file._id;
                        done(error)
                    })
                },
                function (done) {
                    let bufferStream = new stream.PassThrough();
                    bufferStream.end(smallBuffer);

                    ThumbnailGridFs.write({
                        filename: fileName,
                        contentType: thumbnail.contentType
                    }, bufferStream, (error, file) => {
                        thumbnailBody.small = file._id;
                        done(error)
                    })
                },
                function (done) {
                    let bufferStream = new stream.PassThrough();
                    bufferStream.end(posterBuffer);

                    ThumbnailGridFs.write({
                        filename: posterName,
                        contentType: thumbnail.contentType
                    }, bufferStream, (error, file) => {
                        thumbnailBody.poster = file._id;
                        done(error)
                    })
                }
            ], async function (err) {

                if (err) {
                    let message = err.message ? err.message : 'Something went wrong!';
                    await unlinkGridFs(req.files.film[0].id, thumbnailBody._id, thumbnailBody.poster, thumbnailBody.preview, thumbnailBody.small);
                    return res.status(400).send({ error: message })
                }


                const session = await mongoose.startSession();

                await session.withTransaction(async function executor() {
                    const filmBody = {
                        _id: req.files.film[0].id,
                        author_name: req.user.name,
                        author_id: req.user._id,
                        description: req.body.description,
                        title: req.body.title,
                        thumbnail: thumbnailBody
                    };

                    const filmDetailBody = {
                        film_id: req.files.film[0].id,
                    }


                    let film = await Film.create([filmBody], { session: session })
                        .then((film) => film[0].view(true));

                    let details = await FilmDetail.create([filmDetailBody], { session: session })
                        .then(details => details[0].view(false))

                    await session.commitTransaction();
                    session.endSession();
                    return success(res, 201)({ ...film, ...details });
                }).catch(async (err) => {
                    console.error(err)
                    await unlinkGridFs(req.files.film[0].id, thumbnailBody._id, thumbnailBody.poster, thumbnailBody.preview, thumbnailBody.small);
                    return res.status(400).send({ error: 'Something went wrong!' })
                })
            })
        })
    })

};

const index = async (req, res, next) => {

    if (!ObjectId.isValid(req.params.id)) return res.status(400).end();


    let film = await Film.findOne({ _id: req.params.id })

    if (!film) return res.status(404).send({ error: `Film cannot be found!` })


    let filmDetails = await FilmDetail.findOne({ film_id: film.id })
        .then(details => {
            if (!details) return details
            let comments = details.comments.map(comment => comment.view())
            return { comments: comments, comments_count: details.comments_count }
        })

    if (!filmDetails) return res.status(404)
        .send({ error: `FilmDetails cannot be found!` })

    return res.status(200).send({ ...film.view(true), ...filmDetails })
};

const showThumbnail = async ({ params, query }, res, next) => {

    const ThumbnailGridFs = require('../thumbnail/gridfs');


    let film = await Film
        .findOne({ _id: params.id });

    if (film === null)
        return notFound(res)(null);


    let width = 900;
    let height = Math.round(width / 1.77777);

    let ratio = 16 / 9;

    if (query.ratio) {
        let r = query.ratio.split('/');
        ratio = parseInt(r[0]) / parseInt(r[1]);
    }

    if (query.width && !Number.isNaN(parseInt(query.width))) {
        width = parseInt(query.width);
        height = Math.round(width / ratio);
    }

    let thumbnailId = film.thumbnail._id;

    if (query.width && query.width === 'small') {
        thumbnailId = film.thumbnail.small;
    }

    if (query.width && query.width === 'poster') {
        thumbnailId = film.thumbnail.poster;
    }

    if (query.width && query.width === 'preview') {
        thumbnailId = film.thumbnail.preview;
    }


    await ThumbnailGridFs.findById({ _id: ObjectId(thumbnailId) }, (err, thumbnail) => {


        if (err || thumbnail === null)
            return notFound(res)();


        let stream = thumbnail.read();

        if (query.width && query.width !== 'small' && query.width !== 'poster' && query.width !== 'preview') {
            let buffer = [];

            stream.on('data', function (chunk) {
                buffer.push(chunk);

            });

            stream.on('end', async function () {
                let all = new Buffer.concat(buffer);
                await sharp(all)
                    .resize(width, height)
                    .toBuffer()
                    .then(data => {
                        res.set('Content-Length', data.length);
                        res.set('Content-Type', thumbnail.contentType);
                        res.write(data);
                        res.end();

                    })
                    .catch(err => {
                        console.log(err)
                    });
            });
        } else {
            res.set('Content-Length', thumbnail.length);
            res.set('Content-Type', thumbnail.contentType);
            stream.pipe(res);
        }

    });

};

const showFilm1 = (req, res, next) => {

    const {params} = req;

    const FilmGridFs = require('./gridfs');


    FilmGridFs.findById({ _id: params.id}, (err, film) => {
        if (err || film === null) return notFound(res)();

        if (req.headers['range']) {

            console.log("HEAD RANGE");
            let positions = req.headers['range'].replace(/bytes=/, "").split("-");
            let start = parseInt(positions[0], 10);
            let total = film.length;
            let end = positions[1] ? parseInt(positions[1], 10) : total - 1;
            let chunksize = (end - start) + 1;

            let maxChunk = 1024 * 1024; // 1MB at a time
            if (chunksize > maxChunk) {
                end = start + maxChunk - 1;
                chunksize = (end - start) + 1;
            }

            res.writeHead(206, {
                'Content-Range': 'bytes ' + start + '-' + end + '/' + total,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunksize,
                'Content-Type': film.contentType
            });


            let filmStream = FilmGridFs.read({start: start, end: end, filename: film.filename});
            filmStream.pipe(res);

        } else {
            console.log("NORMAl REQUEST");
            res.header('Content-Type', film.contentType);
            res.header('Content-Length', film.length);
            let filmStream = FilmGridFs.read({filename: film.filename});
            filmStream.pipe(res);
        }
    });
}

const showFilm = async (req, res, next) => {
    try {
        const bucket = new FSBucket(mongoose.connection.db, 'films')
        const FilmGridFs = require('./gridfs');
        const film = await FilmGridFs.findById(req.params.id)
        console.log(film)
        await bucket.streamByMD5(req, res, film)
    } catch (err) {
        console.log(err)
    }
    {
        /*  try {
             const { id } = req.params;
             const range = req.headers.range;
     
             const gfs = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
                 bucketName: 'films',
             });
     
             console.log(gfs)
     
             const FilmGridFs = require('./gridfs');
             const film = await FilmGridFs.findById(id)
             const size = film.length
     
             if (!film) {
                 return res.status(404).send({ message: 'Film not found.' });
             }
     
             if (range) {
                 let [start, end] = range.replace(/bytes=/, "").split("-");
                 start = parseInt(start, 10);
                 end = end ? parseInt(end, 10) : size - 1;
     
                 if (!isNaN(start) && isNaN(end)) {
                     start = start;
                     end = size - 1;
                 }
                 if (isNaN(start) && !isNaN(end)) {
                     start = size - end;
                     end = size - 1;
                 }
     
                 if (start >= size || end >= size) {
                     res.writeHead(416, {
                         "Content-Range": `bytes ${size}`
                     });
                     return res.end();
                 }
     
                 res.writeHead(206, {
                     "Content-Range": `bytes ${start}-${end}/${size}`,
                     "Accept-Ranges": "bytes",
                     "Content-Length": end - start + 1,
                     "Content-Type": film.contentType
                 });
     
                 gfs.openDownloadStreamByName(film.filename, { start: start, end: end }).pipe(res)
     
             } else {
     
                 res.writeHead(200, {
                     "Content-Length": size,
                     "Content-Type": film.contentType
                 });
                 gfs.openDownloadStreamByName(film.filename).pipe(res)
             }
      */
        /* 
                gfs.findOne({ filename: film.filename }, (err, file) => {
                    console.log('daldla', err)
                    const { range } = req.headers;
                    const { length } = file;
        
                    const startChunk = Number(
                        (range || '').replace(/bytes=/, '').split('-')[0],
                    );
        
                    const endChunk = length - 1;
                    const chunkSize = endChunk - startChunk + 1;
        
                    res.set({
                        'Content-Range': `bytes ${startChunk}-${endChunk}/${length}`,
                        'Content-Length': chunkSize,
                        'Content-Type': film.contentType,
                        'Accept-Ranges': 'bytes',
                    });
        
                    res.status(206);
        
                    const podcastReadStream = gfs.createReadStream({
                        filename: file.filename,
                        range: {
                            startPos: startChunk,
                            endPos: endChunk,
                        },
                    });
        
                    console.log(file.filename)
                    console.log(podcastReadStream)
                    podcastReadStream.on('open', () => podcastReadStream.pipe(res));
        
                    podcastReadStream.on('end', () => res.end());
                }); 
    } catch (err) {
        console.log(err)
        next(err);
    }*/
    }
};

const getVideo = (req, res, next) => {

    const { params } = req;

    const FilmGridFs = require('./gridfs');

    FilmGridFs.findById({ _id: params.id }, (err, film) => {
        if (err || film === null) return notFound(res)();

        {
            /* if (req.headers['range']) {
                console.log('dscd')
    
                let positions = req.headers['range'].replace(/bytes=/, "").split("-");
    
                let total = film.length;
                let start = parseInt(positions[0], 10);
                let end = positions[1] ? parseInt(positions[1], 10) : total - 1;
    
                let chunksize = (end - start) + 1;
    
                let maxChunk = 1024 * 1024; // 1MB at a time
                if (chunksize > maxChunk) {
                    end = start + maxChunk - 1;
                    chunksize = (end - start) + 1;
                }
    
                if (start >= total || end >= total) {
                    // Return the 416 Range Not Satisfiable.
                    res.writeHead(416, {
                        "Content-Range": `bytes /${total}`
                    });
                    return res.end();
                }
    
                res.writeHead(206, {
                    'Content-Range': 'bytes ' + start + '-' + end + '/' + total,
                    'Accept-Ranges': 'bytes',
                    'Content-Length': chunksize,
                    'Content-Type': film.contentType
                });
    
    
                let filmStream = FilmGridFs.read({ start: start, end: end, filename: film.filename });
                filmStream.pipe(res);
    
            } else {
                console.log('aldllad')
                const head = {
                    'Content-Length': film.length,
                    'Content-Type': film.contentType
                }
                res.writeHead(200, head)
                let filmStream = FilmGridFs.read({ filename: film.filename });
                filmStream.pipe(res);
            } */
        }

        const size = film.length;
        const range = req.headers.range;

        if (range) {
            let [start, end] = range.replace(/bytes=/, "").split("-");
            start = parseInt(start, 10);
            end = end ? parseInt(end, 10) : size - 1;

            if (!isNaN(start) && isNaN(end)) {
                start = start;
                end = size - 1;
            }
            if (isNaN(start) && !isNaN(end)) {
                start = size - end;
                end = size - 1;
            }

            const maxChunk = 1024 * 1024;
            let chunksize = (end - start) + 1;

            if (chunksize > maxChunk) {
                end = start + maxChunk - 1;
                chunksize = (end - start) + 1;
            }

            if (start >= size || end >= size) {
                res.writeHead(416, {
                    "Content-Range": `bytes */${size}`
                });
                return res.end();
            }

            res.writeHead(206, {
                "Content-Range": `bytes ${start}-${end}/${size}`,
                "Accept-Ranges": "bytes",
                "Content-Length": chunksize,
                "Content-Type": film.contentType
            });

            const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'films', chunkSizeBytes: chunksize, });
            console.log(bucket)

            const downloadStream = bucket.openDownloadStreamByName(film.filename, {
                start,
                end
            });
            downloadStream.pipe(res);

            // let filmStream = FilmGridFs.read({ start: start, end: end, filename: film.filename });
            // filmStream.pipe(res);

        } else {

            res.writeHead(200, {
                "Content-Length": size,
                "Content-Type": "video/mp4"
            });

            let filmStream = FilmGridFs.read({ filename: film.filename });
            filmStream.pipe(res);

        }
    });

};

const getAll = ({ query }, res, next) => {

    const limit = parseInt(query.limit) || 10;
    const skip = parseInt(query.skip) || 0;

    let find = {};

    if (query.exclude && !ObjectId.isValid(query.exclude)) return res.status(400).end();

    if (query.exclude) find = { _id: { $nin: [query.exclude] } };

    if (query.search) find = { ...find, title: new RegExp(query.search) }

    Film.find(find)
        .skip(skip)
        .limit(limit)
        .then(film => film.map(film => film.view(true)))
        .then(success(res))
        .catch(next);
};

const update = function ({ user, body, params }, res, next) {

    if (!Object.keys(body).length || !body.title || !body.description)
        return res.status(400).send({ error: 'Please provide title and description to perform a full film update!' })


    let filmBody = { title: body.title, description: body.description }

    let details = filmDetail.findOne({ film_id: film_id })

    if (!details) return notFound(res)(null)

    if (!(user.role === 'admin' || user._id.equals(details.author_id)))
        return res.status(403).end()

    Film.findById(params.id)
        .then(notFound(res))
        .then((film) => film ? Object.assign(film, filmBody).save() : null)
        .then((film) => film ? film.view(true) : null)
        .then(success(res))
        .catch(next);

};



const partialUpdate = function ({ user, body, params }, res, next) {

    if (!Object.keys(body).length)
        return res.status(400).send({ error: 'Please provide title or description to perform a partial film update!' })

    let filmBody = {}

    if (body.title) filmBody = { ...filmBody, title: body.title }
    if (body.description) filmBody = { ...filmBody, description: body.description }

    let details = filmDetail.findOne({ film_id: film_id })

    if (!details) return notFound(res)(null)

    if (!(user.role === 'admin' || user._id.equals(details.author_id)))
        return res.status(403).end()

    Film.findById(params.id)
        .then(notFound(res))
        .then((film) => film ? Object.assign(film, filmBody).save() : null)
        .then((film) => film ? film.view(true) : null)
        .then(success(res))
        .catch(next);
};



const view = ({ body, params }, res, next) =>
    Film.findOneAndUpdate({ _id: params.id }, { $inc: { 'meta.views': 1 } }, { new: true })
        .then(notFound(res))
        .then((film) => film ? film.view(true) : null)
        .then(success(res))
        .catch(next);



const like = async (req, res, next) => {

    const user = req.user;
    const action = req.body.action;

    const film_id = ObjectId(req.params.id)

    if (action !== 'like' && action !== 'dislike') return res.status(400).send({ error: '`action` param must be either like or dislike' })

    const session = await mongoose.startSession()
    await session.withTransaction(async function executor() {
        let userDetails = await UserDetails.findOne({ user_id: user._id }).session(session)

        let filmUpdate = {}

        if (action === 'dislike') {
            const added = await userDetails.disliked.addToSet(film_id)
            const length = userDetails.liked.length
            await userDetails.liked.pull(film_id)

            if (added.length > 0) filmUpdate = { ...filmUpdate, 'meta.dislikes': 1 }
            if (userDetails.liked.length !== length) filmUpdate = { ...filmUpdate, 'meta.likes': -1 }
            if (added.length === 0) {
                await userDetails.disliked.pull(film_id)
                filmUpdate = { ...filmUpdate, 'meta.dislikes': -1 }
            }
        } else {
            const added = userDetails.liked.addToSet(film_id)
            const length = userDetails.disliked.length
            userDetails.disliked.pull(film_id)

            if (added.length > 0) filmUpdate = { ...filmUpdate, 'meta.likes': 1 }
            if (userDetails.disliked.length !== length) filmUpdate = { ...filmUpdate, 'meta.dislikes': -1 }
            if (added.length === 0) {
                await userDetails.liked.pull(film_id)
                filmUpdate = { ...filmUpdate, 'meta.likes': -1 }
            }
        }

        let film = await Film.findOneAndUpdate({ _id: film_id }, { $inc: filmUpdate }, { new: true })

        await userDetails.save();

        await session.commitTransaction()
        session.endSession()

        return success(res)(film.view(true))

    }).catch((err) => {
        console.error(err)
        return res.status(500).send({ error: 'Something went wrong!' })
    })
};

const destroy = async (req, res, next) => {
    const session = await mongoose.startSession()

    await session.withTransaction(async function executor() {
        const { film_id } = req.params;

        if (!ObjectId.isValid(film_id)) return res.status(400).end();

        const user = req.user;

        let film = await Film.findById(film_id)

        if (!film) return notFound(res)(null)

        if (!(user.role === 'admin' || user._id.equals(film.author_id))) {

            await session.abortTransaction()
            session.endSession()

            return res.status(403).end()
        }

        await FilmDetail.deleteOne({ film_id: film_id })
            .session(session)

        await Film.deleteOne({ _id: film_id })
            .session(session);

        await Comment.deleteMany({ _id: { $in: film.comments } }).session(session);

        await unlinkGridFs(film_id, film.thumbnail.id, film.thumbnail.small, film.thumbnail.poster, film.thumbnail.preview)

        await session.commitTransaction()
        session.endSession()

        return res.status(204).end()

    }).catch(() => {
        return res.status(500).json({ error: 'Something went wrong!' })
    })


};


const search = ({ params, query }, res, next) => {

    const limit = parseInt(query.limit) || 10;
    const skip = parseInt(query.skip) || 0;

    let sort = {};

    let projection = '_id title meta thumbnail author author_name description createdAt'

    if (query.p)
        projection = '_id';

    if (query.sort) {
        if (query.sort === 'upload_date') {
            sort = { sort: { createdAt: query.dir } };
        } else if (query.sort === 'view_count') {
            sort = { sort: { 'meta.views': query.dir } };
        } else if (query.sort === 'rating') {
            sort = { sort: { 'meta.likes': query.dir } };
        }
    }


    if (query.filter && query.filter !== '') {

        let currentDate = new Date();
        let destDate = new Date();

        if (query.filter === 'last_hour') {
            destDate.setHours(currentDate.getHours() - 1);
        } else if (query.filter === 'today') {
            destDate.setHours(0);
            destDate.setMinutes(0);
            destDate.setSeconds(0);
        } else if (query.filter === 'this_week') {
            destDate.setHours(0);
            destDate.setMinutes(0);
            destDate.setSeconds(0);

            let distance = 0 - currentDate.getDay();

            destDate.setDate(currentDate.getDate() + distance);
        } else if (query.filter === 'this_month') {
            destDate.setHours(0);
            destDate.setMinutes(0);
            destDate.setSeconds(0);

            let distance = 0 - currentDate.getDate();
            destDate.setDate(currentDate.getDate() + distance + 1);
        } else if (query.filter === 'this_year') {
            destDate.setHours(0);
            destDate.setMinutes(0);
            destDate.setSeconds(0);
            destDate.setDate(0);
            destDate.setMonth(0);

            let distance = 0 - currentDate.getMonth();
            destDate.setDate(currentDate.getMonth() + distance + 2);
        }


        Film.find({ title: new RegExp("^" + query.search, 'i') }, projection, sort)
            .where('createdAt').gte(destDate).lte(currentDate)
            .skip(skip).limit(limit)
            .then(film => film.map(film => film.view(true)))
            .then(success(res))
            .catch(next);

    } else {

        Film.find({ title: new RegExp("^" + query.search, 'i') }, projection, sort)
            .skip(skip).limit(limit)
            .then(films => films.map(film => film.view(true)))
            .then(success(res))
            .catch(next);
    }
};


module.exports = {
    create,
    index,
    getAll,
    getVideo,
    showFilm,
    showFilm1,
    showThumbnail,
    update,
    partialUpdate,
    destroy,
    search,
    view,
    like,
};