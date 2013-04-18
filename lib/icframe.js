var fs = require('fs'),
    cluster = require('cluster'),
    configUtil = require('./configutil'),
    config = configUtil.baseConfig(),
    logger = require('./logger');

var watchers = [],
    monitorTimer,
    serverStarted = false,
    isRestart, launchedWork = 0;

function createWorker(obj) {
    var worker = cluster.fork(obj || '');
    return worker;
}

function startWorkers() {
    isRestart = false;
    serverStarted = false;

    config = configUtil.baseConfig(true);
    logger.console();
    logger.console('Begin start Server, Please Wait...');
    for (var i = 0; i < config.processNum; i++) {
        createWorker({
            _hideConfigLog: i != 0
        });
    }
}

function doMonitor() {
    clearTimeout(monitorTimer);
    monitorTimer = setTimeout(function() {
        isRestart = true;
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

exports.start = function() {
    cluster.setupMaster({
        exec: __dirname + '/worker.js'
    });

    startWorkers();

    // worker started
    cluster.on('listening', function(worker) {
        launchedWork += 1;
        logger.console('Worker (PID) ' + worker.process.pid + ' has started! Current Workers Num: ' + launchedWork);

        if (config.processNum == launchedWork && !serverStarted) {
            logger.separator();
            logger.console('Server has started, you can start browsing your website now!');
            // start monitor files change
            monitorFiles();
            serverStarted = true;
        }
    });

    // worker exit
    cluster.on('exit', function(worker, code, signal) {
        launchedWork -= 1;
        logger.console('Worker (PID) ' + worker.process.pid + ' has stopped!' + ' Left Workers Num: ' + launchedWork);

        // worker unnormal exit, create a new worker
        if (!worker.suicide) {
            createWorker();
        } else {
            // all worker was killed
            if (launchedWork == 0) {
                if (isRestart) {
                    logger.separator();
                    for (var i = 0; i < 3; i++) {
                        logger.console();
                    }
                    startWorkers();
                } else {
                    logger.console('Server has closed successful!');
                    logger.console();
                    process.exit(0);
                }
            }
        }
    });

    // exit
    process.on('SIGINT', function() {
        logger.console();
        logger.separator();
        logger.console('Start closing workers, Pleast wait a moment......');
        // every worker kill itself
        Object.keys(cluster.workers).forEach(function(id) {
            var worker = cluster.workers[id];
            worker.once('message', function(obj) {
                if (obj.cmd == 'KILL_ME') {
                    worker.kill();
                }
            }).send({
                cmd: 'KILL'
            });
        });
    });

    process.on('exit', function() {
        logger.info('[SERVER EXIT]: pid=' + process.pid);
    });
    process.on('uncaughtException', function(err) {
        logger.info('[SERVER UNCAUGHT EXCEPTION]: ' + err);
    });
};