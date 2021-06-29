const success = (res, status, text) => (entity) => {
    if (text) {
        res.status(status || 200).json(text);
    } else {
        if (entity) {
            res.status(status || 200).json(entity);
        }
    }

    return null;
};

const notFound = (res) => (entity) => {
    if (entity) {
        return entity;
    }
    res.status(404).end();
    return null;
};

const noCommentsFound = (res) => (entity) => {
    if (entity.length > 0) {
        return entity;
    }
    res.status(200).send({}).end();
    return null;
};

module.exports = {
    success, notFound, noCommentsFound
};
