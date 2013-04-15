var cluster = require('cluster'),
    utils = require('utilities'),
    config = require('./config'),
    path = require('path'),
    fs = require('fs'),
    logger,
    gearman;

var memwatch = require('memwatch');

global.icFrame = exports;
// init config first
exports.config = config;
// init logger
logger = exports.logger = require('./logger');

// extend other global vars
utils.mixin(exports, {
    version: '0.1.0',
    utils: utils,
    gearman: gearman = require('./gearman'),
    submitJob: gearman.submitJob.bind(gearman)
});

// [ref]: geddy worker.js
exports.createServer = function() {
    var ssl = config.ssl,
        APP = exports.APP = require('./application'),
        app = exports.app = APP.app,
        server;

    // If SSL options were given
    if (ssl) {
        if (ssl.cert && ssl.key) {
            server = require('https').createServer({
                key: fs.readFileSync(ssl.key),
                cert: fs.readFileSync(ssl.cert)
            }, app);
        } else {
            logger.error('Cannot start server using SSL.' + 'Missing certificate or private key.');
        }
    } else { // If neither SSL or SPDY options were given use HTTP
        server = require('http').createServer(app);
    }
    return server;
};

exports.start = function() {
    var workers = [],
        monitor = icFrame.config.monitor,
        monitorDelay = icFrame.config.monitorDelay || 0,
        timer;

    if (cluster.isMaster) {
        var i, isRestart, worker, launchedWork;
        var closeServer = false;

        memwatch.on('leak', function(info) {
            logger.warn(info);
        });
        setInterval(function(){
            memwatch.gc();
        }, 5000);

        var createOneWorker = function() {
            worker = cluster.fork();
            workers.push(worker);
            logger.console('Starting Worker (PID): ' + worker.process.pid);
        };
        var startWorkers = function() {
            launchedWork = 0;
            logger.console(JSON.stringify(config), true);
            for (i = 0; i < config.processNum; i++) {
                createOneWorker();
            }
            logger.separator();
            // all workers had started
        };

        logger.console('Begin start Servers, Please Wait...');
        startWorkers();

        cluster.on('listening', function(worker) {
            logger.console('Server worker running in ' + config.env + ' on port ' + config.port + (config.ssl ? ' (SSL)' : '') + ' with a PID of: ' + worker.process.pid);
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
                    if (closeServer) {
                        logger.console(info + ' Left Workers Num: ' + workers.length);
                    } else {
                        logger.console(info);
                        createOneWorker();
                    }
                }
            }
            // TODO: sometimes some child-process can't exit when call worker.kill
            // this bug is related to gearman (when call: new Gearman(server.ip, server.port))
            // use the method to force exit the process
            if (workers.length == 0) {
                // restart server
                if (isRestart) {
                    isRestart = false;
                    logger.separator();
                    for (var i = 0; i < 5; i++) {
                        logger.console();
                    }
                    // reload config
                    delete require.cache[require.resolve('./config')];
                    config = require('./config');
                    //console.log(config);
                    startWorkers();
                } else {
                    logger.console();
                    process.exit(0);
                }
            }
        });
        // process exit kill all workers
        process.on('SIGINT', function() {
            closeServer = true;
            for (i = 0; i < workers.length; i++) {
                workers[i].kill();
            }
        });
        // =======================================
        // monitor file change and restart workers
        // =======================================
        if (monitor && monitor.length) {
            monitor.forEach(function(file) {
                fs.stat(file, function(err, stat) {
                    if (err) {
                        return logger.console('Watch File ' + file + ' Failure!', err);
                    }
                    fs[stat.isFile() ? 'watchFile' : 'watch'](file, {}, function(e, filename) {
                        clearTimeout(timer);
                        timer = setTimeout(function() {
                            isRestart = true;
                            for (var i = 0; i < 5; i++) {
                                logger.console();
                            }
                            logger.separator();
                            process.kill(process.id, 'SIGINT');
                        }, monitorDelay);
                    });
                });
            });
        }
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