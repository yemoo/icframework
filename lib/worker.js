var fs = require('fs'),
    configUtil = require('./configutil'),
    config = configUtil.baseConfig(),
    logger = require('./logger'),
    utils = require('utilities'),
    gearman = require('./gearman'),
    memwatch = require('memwatch'),
    app;


// PRINT CONFIG INFO
process.send({
    cmd: 'CONFIG_INFO',
    args: JSON.stringify(config)
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
global.icFrame = exports;
// extend other global vars
utils.mixin(exports, {
    version: '0.1.0',
    utils: utils,
    validator: require('validator'),
    configUtil: configUtil,
    config: config,
    logger: logger,
    gearman: gearman,
    submitJob: gearman.submitJob.bind(gearman),
    memwatch: memwatch
});
app = exports.app = require('./application');

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
var closeMaxTimeout = config.timeout || server.timeout,
    closeTimer,
    notifyFinished = function() {
        clearTimeout(closeTimer);
        process.send({
            cmd: 'WORKER_FINISHED'
        });
    };

process.on('message', function(msg) {
    if (msg.cmd == 'FINISH_PROCESS') {
        process.finished = true;
        // stop accepting new connections
        !process.finished && server.close();
        // waiting all request process completed
        if (requestProcessing <= 0) {
            notifyFinished();
        } else {
            process.once('SERVER_FREE', notifyFinished);
            closeTimer = setTimeout(notifyFinished, closeMaxTimeout);
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
    icFrame.gearman.closeClients();
    logger.info('[WORKER EXIT]: pid=' + process.pid);
});
process.on('uncaughtException', function(err) {
    logger.info('[WORKER UNCAUGHT EXCEPTION]: pid=' + process.pid + ', ' + err);
});