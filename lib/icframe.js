var fs = require('fs'),
    cluster = require('cluster'),
    semver = require('semver'),
    configUtil = require('./configutil'),
    config = configUtil.baseConfig(),
    logger = require('./logger'),
    watchers = [],
    monitorTimer;

function createWorker() {
    var worker = cluster.fork(),
        pid = worker.process.pid;

    worker.once('listening', function() {
        logger.console('Worker (PID) ' + pid + ' has started! Current Workers Num: ' + Object.keys(cluster.workers).length);
    });
    worker.once('exit', function() {
        logger.console('Worker (PID) ' + pid + ' has stopped! Current Workers Num: ' + Object.keys(cluster.workers).length);

        if (!worker.suicide) {
            createWorker();
        }
    });
    worker.once('message', function(msg) {
        if (msg.cmd == 'CONFIG_INFO') {
            process.emit('PRINT_CONFIG', msg.args)
        }
    });

    return worker;
}

function startWorkers(callback, hideLog) {
    var startedNum = 0,
        totalNum, worker;

    config = configUtil.baseConfig(true);
    totalNum = config.processNum;

    if (!hideLog) {
        logger.console();
        logger.console('Begin start Server, Please Wait...');
        logger.separator();
    }

    // print config
    process.once('PRINT_CONFIG', function(config) {
        logger.console('[CURRENT CONFIG]');
        logger.console(config, true);
    });

    for (var i = 0; i < totalNum; i++) {
        worker = createWorker();
        worker.once('listening', function() {
            if (++startedNum == totalNum) {
                if (!hideLog) {
                    logger.separator();
                    logger.console('Server has started, Total Workers Num: ' + Object.keys(cluster.workers).length + ', you can start browsing your website now!');
                }
                // monitor files change
                monitorFiles();

                callback && callback();
            }
        });
    }
}

function killWorkers(ids) {
    var workerIds = ids || Object.keys(cluster.workers),
        totalNum = workerIds.length,
        closedNum = 0;

    logger.console();
    logger.console('Start closing workers, Pleast wait a moment......');
    logger.separator();

    workerIds.forEach(function(id) {
        var worker = cluster.workers[id];

        worker.once('message', function(msg) {
            if (msg.cmd == 'WORKER_FINISHED') {
                worker.kill();
            }
        }).once('exit', function() {
            if (++closedNum == totalNum) {
                process.emit('ALL_WORKERS_KILLED');
            }
        });
        // notify worker process to finish it's processing
        worker.send({
            cmd: 'FINISH_PROCESS'
        });
    });
}

function doMonitor() {
    clearTimeout(monitorTimer);
    monitorTimer = setTimeout(function() {
        process.emit('RESTART_SERVER');
    }, config.monitorDelay || 0);
}

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
                logger.warn('Watching file ' + file + ' is not exist!');
            } else {
                watchers.push(fs.watch(file, doMonitor));
            }
        });
        logger.separator();
        logger.console('Server file changes are being watched!');
    }
}

exports.start = function() {
    // version not match
    var minVersion = require('../package.json').engines.node;
    if (!semver.satisfies(process.version, minVersion)) {
        logger.error('Please update your version of the node to ' + minVersion + ' or above!\n');
        process.exit(0);
        return;
    }

    cluster.setupMaster({
        exec: __dirname + '/worker.js'
    });

    startWorkers();

    // exit server
    process.on('SIGINT', function() {
        process.once('ALL_WORKERS_KILLED', function() {
            logger.separator();
            logger.console('Server has closed successful!');
            logger.console();
            process.exit(0);
        });
        killWorkers();
    });
    // restart server
    process.on('RESTART_SERVER', function() {
        var curWorkerIds = Object.keys(cluster.workers);
        logger.separator();
        for (var i = 0; i < 3; i++) {
            logger.console();
        }
        startWorkers(function() {
            killWorkers(curWorkerIds);
        }, true);
    });

    // exit log
    process.on('exit', function() {
        logger.info('[SERVER EXIT]: pid=' + process.pid);
    });
    // exception log
    process.on('uncaughtException', function(err) {
        logger.info('[SERVER UNCAUGHT EXCEPTION]: ' + err);
    });
};