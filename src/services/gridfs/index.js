const { GridFSBucket } = require('mongodb')

function log(message, ...args) {
    const date = new Date()
    console.log(
        `[${Intl.DateTimeFormat('en-US', {
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
            second: 'numeric',
        }).format(date)} . ${date.getMilliseconds()}ms] ${message}`,
        ...args
    )
}

class FSBucket {
    constructor(db, bucketName) {
        this.bucket = new GridFSBucket(db, { bucketName: bucketName })
        this.db = db
        this.collection = `${bucketName}.files`
    }

    getFileInfoByMD5(md5) {
        return new Promise((resolve, reject) => {
            try {
                this.db
                    .collection(this.collection)
                    .findOne({ 'metadata.md5': md5 }, (err, result) => {
                        if (err) {
                            return reject(err)
                        }
                        return resolve(result)
                    })
            } catch (err) {
                return reject(err)
            }
        })
    }

    async streamByMD5(req, res, fileInfo) {
        // const fileInfo = await this.getFileInfoByMD5(md5)

        log('headers', req.headers['range'])

        if (!fileInfo) {
            return res.status(404).json({ message: 'Invalid trackID in URL parameter.' })
        }
        log(`stream requested: ${fileInfo.filename}`)
        const contentType = fileInfo.contentType
        let responseHeaders = {}

        if (req.headers['range']) {
            const rangeRequest = this.readRangeHeader(req.headers['range'], fileInfo.length)

            if (
                rangeRequest.Start === rangeRequest.End &&
                rangeRequest.Start === fileInfo.length - 1
            ) {
                // Only safari seems to ask for: bytes=32291229-32291229
                // in a hot loop, could be jamming resources
                return res.end()
            }

            if (rangeRequest === null) {
                responseHeaders['Content-Type'] = contentType
                responseHeaders['Content-Length'] = fileInfo.length
                responseHeaders['Accept-Ranges'] = 'bytes'
            }

            const start = rangeRequest.Start
            let end = rangeRequest.End

            // If the range can't be fulfilled.
            if (start >= fileInfo.length || end >= fileInfo.length) {
                // Indicate the acceptable range.
                responseHeaders['Content-Range'] = 'bytes */' + fileInfo.length // File size.

                // Return the 416 'Requested Range Not Satisfiable'.
                res.writeHead(416, responseHeaders)
                return res.end()
            }
           

            responseHeaders['Content-Range'] = 'bytes ' + start + '-' + end + '/' + fileInfo.length
            responseHeaders['Content-Type'] = contentType
            responseHeaders['Accept-Ranges'] = 'bytes'
            responseHeaders['Cache-Control'] = 'no-cache'
            responseHeaders['Content-Transfer-Encoding'] = 'binary'

            log(`informing request of partial HTTP 206`)
            res.writeHead(206, responseHeaders)

            
            log(`creating download stream, for bytes ${start} through ${end}`)
            const downloadStream = this.bucket.openDownloadStream(fileInfo._id, {
                start: start,
                end: end,
            })

            downloadStream.on('data', chunk => {
                // console.debug(`chonk: ${chunk.length} bytes`)
                res.write(chunk)
            })

            downloadStream.on('error', (err) => {
                console.log(err)
                res.sendStatus(404)
            })

            downloadStream.on('end', () => {
                log(`end of stream [${start} - ${end}]`)
                log('---------------------------------------------------------------------------')
                res.end()
            })
        } else {
            responseHeaders['Content-Type'] = contentType
            responseHeaders['Content-Length'] = fileInfo.length
            responseHeaders['Accept-Ranges'] = 'bytes'
            responseHeaders['Cache-Control'] = 'no-cache'
            responseHeaders['Content-Transfer-Encoding'] = 'binary'

            res.writeHead(200, responseHeaders)

            const downloadStream = this.bucket.openDownloadStream(fileInfo._id)
            downloadStream.pipe(res)
        }
    }

    readRangeHeader(range, totalLength) {
        /*
         * Example of the method 'split' with regular expression.
         *
         * Input: bytes=100-200
         * Output: [null, 100, 200, null]
         *
         * Input: bytes=-200
         * Output: [null, null, 200, null]
         */
        if (range == null || range.length == 0) return null

        var array = range.split(/bytes=([0-9]*)-([0-9]*)/)
        var start = parseInt(array[1])
        var end = parseInt(array[2])

        var result = {
            Start: isNaN(start) ? 0 : start,
            End: isNaN(end) ? totalLength - 1 : end,
        }

        if (!isNaN(start) && isNaN(end)) {
            result.Start = start
            result.End = totalLength - 1
        }

        if (isNaN(start) && !isNaN(end)) {
            result.Start = totalLength - end
            result.End = totalLength - 1
        }
        // log(range, totalLength, result)
        return result
    }
}

module.exports = FSBucket