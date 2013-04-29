var fs = require('fs'),
    path = require('path'),
    cluster = require('cluster'),
    semver = require('semver'),
    program = require('commander'),
    logger = require('./logger'),
    watch = require('watch'),
    processNum,
    watches = [],
    timer;

function watchTree(root, options, callback) {
    var argLen = arguments.length,
        args = [root],
        defCallback = function(f, curr, prev) {
            if (typeof f != "object" || prev !== null || curr !== null) {
                clearTimeout(timer);
                timer = setTimeout(function() {
                    process.emit('RESTART_SERVER');
                }, 1000);
            }
        }, watched;

    if (argLen < 3 && typeof arguments[argLen - 1] != 'function') {
        args.push(defCallback);
    }

    watched = watches.some(function(dir) {
        var result = path.relative(dir, root);
        return (!result || !~result.indexOf('..'));
    });

    if (!watched) {
        watch.watchTree.apply(watch, args);
        watches.push(root);
    }
}

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
    worker.on('message', function(msg) {
        var config;
        if (msg.cmd == 'CONFIG_INFO') {
            config = JSON.parse(msg.args);
            // print config info
            process.emit('PRINT_CONFIG', config);
            // monitor view or controller
            watchTree(config.view.path);
            watchTree(config.ctrlpath);
        } else if (msg.cmd == 'EADDRINUSE') {
            worker.kill();
        }
    });

    return worker;
}

function startWorkers(callback, hideLog) {
    var startedNum = 0,
        worker;

    if (!hideLog) {
        logger.console('Begin start Server, Please Wait...');
    }

    // print config
    process.once('PRINT_CONFIG', function(config) {
        config.processNum = processNum;
        logger.console(require('util').inspect(config, {
            depth: 3
        }), true, 'CURRENT CONFIG');
    });

    for (var i = 0; i < processNum; i++) {
        worker = createWorker();
        worker.once('listening', function() {
            if (++startedNum == processNum) {
                if (!hideLog) {
                    logger.console('Server has started, Total Workers Num: ' + Object.keys(cluster.workers).length + ', you can start browsing your website now!', true);
                    logger.console('Watching Directories: ' + watches.join(', '));
                }

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

        if (worker) {
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
        }

    });
}

exports.start = function() {
    // version not match
    var packageInfo = require('../package.json'),
        minVersion = packageInfo.engines.node;

    if (!semver.satisfies(process.version, minVersion)) {
        logger.error('Please update your version of the node to ' + minVersion + ' or above!\n');
        process.exit(0);
        return;
    }

    // args
    processNum = require('os').cpus().length;
    program.version(packageInfo.version)
        .option('-p, --processNum <num>', 'setting processNum, default use cpu numbers', function(num) {
        return num && parseInt(num) || processNum;
    }).parse(process.argv);
    processNum = program.processNum || processNum;

    cluster.setupMaster({
        exec: __dirname + '/worker.js'
    });

    startWorkers();

    watchTree(process.cwd());

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
        logger.console();
    });
    // exception log
    process.on('uncaughtException', function(err) {
        logger.info('[SERVER UNCAUGHT EXCEPTION]: ' + err);
        logger.console();
    });
};