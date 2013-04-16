var cluster = require('cluster'),
    config = require('./config'),
    fs = require('fs'),
    logger;

global.icFrame = exports;
// init config first
exports.config = config;
exports.version = '0.1.0';

// init logger
logger = exports.logger = require('./logger');

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
    var workers = [];

    if (cluster.isMaster) {
        var watchers = [],
            timer,
            stopServer = false,
            i, isRestart, worker, launchedWork;

        function createOneWorker(callback) {
            worker = cluster.fork();
            workers.push(worker);
            if (callback) {
                worker.once('message', callback);
            }
            return worker;
        }

        function startWorkers() {
            launchedWork = 0;
            logger.console('Begin start Server, Please Wait...');
            createOneWorker(function(_config) {
                config = icFrame.config = _config;
                logger.console(JSON.stringify(config), true);
                for (i = 0; i < config.processNum - 1; i++) {
                    createOneWorker();
                }
            });
        }

        function doMonitor() {
            clearTimeout(timer);
            timer = setTimeout(function() {
                isRestart = true;
                logger.console();
                logger.separator();
                process.kill(process.id, 'SIGINT');
            }, config.monitorDelay || 0);
        }
        // monitor file change and restart workers

        function monitorFiles() {
            var monitor = config.monitor;
            if (watchers.length) {
                watchers.forEach(function(watcher) {
                    watcher.close();
                });
                watchers = [];
            }
            if (monitor && monitor.length) {
                monitor.forEach(function(file) {
                    if (!fs.existsSync(file)) {
                        logger.warn('Watching File ' + file + ' is Not Exist!');
                    } else {
                        watchers.push(fs.watch(file, doMonitor));
                    }
                });
                logger.separator();
                logger.console('Server file changes are being watched!');
            }
        }

        startWorkers();

        // worker started
        cluster.on('listening', function(worker) {
            logger.console('Worker (PID): ' + worker.process.pid + ' has started!');
            if (config.processNum == ++launchedWork) {
                logger.separator();
                logger.console('Server has started, you can start browsing your website now!');
                // start monitor files change
                monitorFiles();
            }
        });
        // worker exit
        cluster.on('exit', function(worker) {
            var tmpWorker, info = 'Worker (PID) ' + worker.process.pid + ' has stopped!';

            for (i = 0; i < workers.length; i++) {
                tmpWorker = workers[i];
                if (worker.process.pid === tmpWorker.process.pid) {
                    workers.splice(i, 1);
                    if (stopServer) {
                        logger.console(info + ' Left Workers Num: ' + workers.length);
                    } else {
                        logger.console(info);
                        createOneWorker(function(config, worker) {
                            logger.console('Starting Worker (PID): ' + worker.process.pid);
                        });
                    }
                }
            }
            // TODO: sometimes some child-process can't exit after call worker.kill
            // this bug is related to gearman (when call: new Gearman(server.ip, server.port))
            // use exit method to force exit the process
            if (workers.length == 0) {
                // restart server
                if (isRestart) {
                    logger.separator();
                    for (var i = 0; i < 5; i++) {
                        logger.console();
                    }
                    startWorkers();
                    isRestart = false;
                } else {
                    logger.console();
                    process.exit(0);
                }
            }
        });
        // user customer stopServer (ctrl+c)
        process.on('SIGINT', function() {
            stopServer = true;
            for (i = 0; i < workers.length; i++) {
                workers[i].kill();
            }
        });

    } else {
        var utils = require('utilities'),
            gearman = require('./gearman'),
            // memory-leak detect tools
            memwatch = require('memwatch');

        // extend other global vars
        utils.mixin(exports, {
            utils: utils,
            validator: require('validator'),
            gearman: gearman,
            submitJob: gearman.submitJob.bind(gearman),
            memwatch: memwatch
        });

        // memory leak process
        memwatch.on('leak', function(info) {
            logger.warn(info);
        });
        setInterval(function() {
            memwatch.gc();
        }, 5000);

        // start server
        this.createServer().listen(config.port, config.hostname);
        process.send(config);

        // process exit
        process.on('SIGINT', function() {
            process.exit(0);
        });
        process.on('exit', function() {
            icFrame.gearman.closeClients();
        });
    }
}