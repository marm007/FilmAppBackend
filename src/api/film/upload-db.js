const multer = require('multer');
const path = require('path');
const mime = require('mime-types');
const {GridFsStorage} = require('multer-gridfs-storage');

const config = require('../../config');

const storage = new GridFsStorage({
    url: config.mongo.uri,
    file: (req, file) => {

        let bucketName = file.fieldname === 'thumbnail' ? 'thumbnails' : 'films';

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

    if (file.fieldname === 'film' && (file.mimetype === mime.types.mp4 || file.mimetype === mime.types.ogg)) {
        return done(null, true)
    } else if (file.fieldname === 'thumbnail' && (file.mimetype === mime.types.jpeg || file.mimetype === mime.types.png)) {
        return done(null, true)
    }
    done(new Error(`File type: ${file.mimetype} for field ${file.fieldname} is not allowed!`))
}

const uploadDrive = multer({storage: storage, fileFilter: fileFilter}).fields([{name: 'film', maxCount: 1},
    {name: 'thumbnail', maxCount: 1}
]);

module.exports = uploadDrive;
