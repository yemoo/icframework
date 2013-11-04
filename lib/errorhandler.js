var fs = require('fs'),
    path = require('path'),
    utils = icFrame.utils,
    viewDir = icFrame.config.view.path,
    defNotFoundFile = path.join(__dirname, 'errors/404.html'),
    defErrorFile = path.join(__dirname, 'errors/500.html'),
    emptyFn = function() {};

exports.notFound = function(config) {
    if (!config.absolute) {
        config.file = path.join(viewDir, config.file);
    }
    if (!fs.existsSync(config.file)) {
        config.file = defNotFoundFile;
    }
    if (!config.logger || typeof config.logger !== 'function') {
        config.logger = emptyFn;
    }

    return function(req, res, next) {
        res.status(404);
        if (req.accepts('html')) {
            if (config.static) {
                res.sendfile(config.file);
            } else {
                res.render(config.file, {
                    url: req.url,
                    message: config.message
                });
            }
        } else if (req.accepts('json')) {
            res.send({
                error: config.message
            });
        } else {
            res.type('txt').send('404: ' + config.message);
        }
        config.logger(req, res);
        //next();
    };
};

exports.error = function(config) {
    if (!config.absolute) {
        config.file = path.join(viewDir, config.file);
    }
    if (!fs.existsSync(config.file)) {
        config.file = defErrorFile;
    }
    if (!config.logger || typeof config.logger !== 'function') {
        config.logger = emptyFn;
    }

    return function(err, req, res, next) {
        var errCode = err.code || 500;
        res.status(errCode);
        if (req.accepts('html')) {
            if (config.static) {
                res.sendfile(config.file);
            } else {
                res.render(config.file, {
                    code: errCode,
                    url: req.url,
                    message: config.message,
                    detail: err
                });
            }
        } else if (req.accepts('json')) {
            res.send({
                code: errCode,
                error: config.message
            });
        } else {
            res.type('txt').send(errCode + ': ' + config.message);
        }
        config.logger(err, req, res);
        //next();
    };
};