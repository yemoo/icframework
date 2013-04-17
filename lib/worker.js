var fs = require('fs'),
    configUtil = require('./configutil'),
    config = configUtil.baseConfig(),
    logger = require('./logger'),
    utils = require('utilities'),
    gearman = require('./gearman'),
    memwatch = require('memwatch'),
    app;

// print config info
if (process.env._hideConfigLog === 'false') {
    logger.console(JSON.stringify(config), true);
}

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

// memory leak process
memwatch.on('leak', function(info) {
    logger.warn(info);
});
setInterval(function() {
    memwatch.gc();
}, 5000);

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

// process exit
process.on('SIGINT', function() {
    //process.exit(0);
});
process.on('exit', function() {
    icFrame.gearman.closeClients();
    logger.info('[WORKER EXIT]: pid=' + process.pid);
});

process.on('uncaughtException', function(err) {
    logger.info('[WORKER UNCAUGHT EXCEPTION]: pid=' + process.pid + ', ' + err);
});