var cluster = require('cluster'),
    utils = require('utilities'),
    config = require('./config').readConfig(),
    logger,
    gearman;

global.icFrame = exports;
// init config first
exports.config = config;
// init logger
logger = exports.logger = require('./logger');

// extend other global vars
utils.mixin(exports, {
    version: '0.0.1',
    utils: utils,
    gearman: gearman = require('./gearman'),
    submitJob: gearman.submitJob.bind(gearman)
});

// [ref]: geddy worker.js
exports.createServer = function() {
    var ssl = config.ssl,
        app = exports.app = require('./application'),
        server;

    // If SSL options were given
    if (ssl) {
        if (ssl.cert && ssl.key) {
            server = require('https').createServer({
                key: fs.readFileSync(ssl.key),
                cert: fs.readFileSync(ssl.cert)
            }, app);
        } else {
            this.logger.error('Cannot start server using SSL.' + 'Missing certificate or private key.');
        }
    } else { // If neither SSL or SPDY options were given use HTTP
        server = require('http').createServer(app);
    }
    return server;
};

exports.start = function() {
    var workers = [];

    if (cluster.isMaster) {
        var i = 0,
            launchedWork = 0,
            worker;

        logger.console('Begin start Servers, Please Wait...');
        logger.console(JSON.stringify(config), true);

        for (; i < config.processNum; i++) {
            worker = cluster.fork();
            workers.push(worker);
            logger.console('Starting Worker (PID): ' + worker.process.pid);
        }

        logger.separator();
        // worker started
        cluster.on('listening', function(worker) {
            logger.console('Server worker running in ' + config.environment + ' on port ' + config.port + (config.ssl ? ' (SSL)' : '') + ' with a PID of: ' + worker.process.pid);
            if (config.processNum == ++launchedWork) {
                logger.separator();
                logger.console('All Servers are started, you can start browsing your website now!');
            }
        });
        // worker exit
        cluster.on('exit', function(worker) {
            var tmpWorker, info = 'Worker (PID) ' + worker.process.pid + ' has stopped!';
            for (i = 0; i < workers.length; i++) {
                tmpWorker = workers[i];
                if (worker.process.pid === tmpWorker.process.pid) {
                    workers.splice(i, 1);
                    logger.console(info + ' Left Workers Num: ' + workers.length);
                }
            }
            // TODO: sometimes some child-process can't exit when call worker.kill
            // this bug is related to gearman (when call: new Gearman(server.ip, server.port))
            // use the method to force exit the process
            if (workers.length == 0) {
                logger.console();
                process.exit(0);
            }
        });

        // process exit kill all workers
        process.on('SIGINT', function() {
            // echo a blank line
            logger.console();
            for (i = 0; i < workers.length; i++) {
                workers[i].kill();
            }
        });
    } else {
        // start server
        this.createServer().listen(config.port, config.hostname);

        // process exit
        process.on('SIGINT', function() {
            process.exit(0);
        });
        process.on('exit', function() {
            icFrame.gearman.closeClients();
        });
    }
}