const multer = require('multer');
const path = require('path');
const mime = require('mime-types');
const GridFsStorage = require('multer-gridfs-storage');

const config = require('../../config');

const storage = new GridFsStorage({
    url: config.mongo.uri,
    file: (req, file) => {

        let bucketName = 'films';

        if(file.fieldname === 'thumbnail') {
            bucketName = 'thumbnails';
        }

        return {
            filename: path.parse(file.originalname).name + Date.now() + '.' + mime.extension(file.mimetype),
            bucketName: bucketName,
            metadata: {
                originalname: file.originalname
            }
        };
    }
});


function fileFilter(req, file, done) {

    if(req.body.title === ''){
        return done(new Error(`Path title is required!`))

    }else if(req.body.description === ''){
        return done(new Error(`Path description is required!`))
    }

    const fieldname = file.fieldname === 'thumbnail' ? file.fieldname : 'film';

    if ((file.fieldname === 'file' && (file.mimetype === mime.types.mp4 || file.mimetype === mime.types.ogg))
        || ((file.fieldname === 'thumbnail') && (file.mimetype === mime.types.jpeg || file.mimetype === mime.types.png))) {
        return done(null, true)
    }

    done(new Error(`File type: ${file.mimetype} for field ${fieldname} is not allowed!`))
}

const uploadDrive = multer({storage: storage, fileFilter: fileFilter}).fields([{name: 'file', maxCount: 1},
    {name: 'thumbnail', maxCount: 1}
]);

module.exports = uploadDrive;