var fs = require('fs'),
    utils = require('utilities'),
    memwatch = require('memwatch'),
    configUtil, config, logger, gearman, app;

global.icFrame = exports;

// extend other global vars
utils.mixin(exports, {
    version: '0.1.0',
    require: require,
    utils: utils,
    memwatch: memwatch
});

utils.mixin(exports, {
    configUtil: configUtil = require('./configutil'),
    config: config = configUtil.baseConfig(),
});

// FOR PRETTY PRINT
var _config = (function() {
    var _config = utils.mixin({}, config, true);
    if (_config.session.store && typeof _config.session.store == 'function') {
        _config.session.store = _config.session.store.toString().replace(/\s+/g, ' ');
    }
    var engines = _config.view.engines;
    Object.keys(engines).forEach(function(key) {
        engines[key] = '[Function]';
    });
    return _config;
})();

// PRINT CONFIG INFO
process.send({
    cmd: 'CONFIG_INFO',
    args: JSON.stringify(_config)
});

utils.mixin(exports, {
    logger: logger = require('./logger'),
    gearman: gearman = require('./gearman'),
    submitJob: gearman.submitJob.bind(gearman),
});


// =======================
//   memory leak process
// ======================= 
memwatch.on('leak', function(info) {
    logger.warn(info);
});
setInterval(function() {
    memwatch.gc();
}, 10000);


// ====================
//    Create Server
// ====================
exports.APP = require('./application');
app = exports.APP.app;
// If SSL options were given
if (config.ssl) {
    if (config.ssl.cert && config.ssl.key) {
        server = require('https').createServer({
            key: fs.readFileSync(config.ssl.key),
            cert: fs.readFileSync(config.ssl.cert)
        }, app);
    } else {
        exports.logger.error('Cannot start server using SSL.' + 'Missing certificate or private key.');
    }
} else { // If neither SSL or SPDY options were given use HTTP
    server = require('http').createServer(app);
}
// start server
server.listen(config.port, config.hostname);
server.setTimeout(config.timeout);

server.on('close', function() {
    gearman.closeClients();
});
// server is running
server.on('error', function(e) {
    if (e.code == 'EADDRINUSE') {
        process.send({
            cmd: 'EADDRINUSE',
            msg: 'The Server may already run on ' + config.fullHostname + ', Please close it and try again...'
        })
    }
});

// ============================================
//  count total request and processing request
// ============================================
var requestTotal = 0,
    requestProcessing = 0;

process.on('REQUEST_START', function() {
    requestTotal++;
    requestProcessing++;
});
process.on('REQUEST_END', function() {
    requestProcessing--;
    if (requestProcessing <= 0) {
        requestProcessing = 0;
        process.emit('SERVER_FREE');
    }
});

// =================================
//  Custer/Worer Message dispatcher
// ================================= 
var closeTimer,
notifyFinished = function() {
    clearTimeout(closeTimer);
    process.send({
        cmd: 'WORKER_FINISHED'
    });
};

process.on('message', function(msg) {
    if (msg.cmd == 'FINISH_WORKER') {
        // stop accepting new connections
        server.close();
        // waiting all request process completed
        if (requestProcessing <= 0) {
            notifyFinished();
        } else {
            process.once('SERVER_FREE', notifyFinished);
            closeTimer = setTimeout(notifyFinished, config.timeout);
        }
    }
});

// ==============================
//  Process worker state and Log
// ==============================
// WARN: don't delete this listener
process.on('SIGINT', function() {});
// worker exit and exception log
process.on('exit', function() {
    logger.info('[WORKER EXIT]: pid=' + process.pid);
});
process.on('uncaughtException', function(err) {
    logger.info('[WORKER UNCAUGHT EXCEPTION]: pid=' + process.pid + ', ' + err);
});