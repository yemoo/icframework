var fs = require('fs'),
    path = require('path'),
    cluster = require('cluster'),
    semver = require('semver'),
    program = require('commander'),
    logger = require('./logger'),
    watch = require('watch'),
    procNum = require('os').cpus().length,
    watches = [],
    monitorTimeout = 1000,
    monitorTimer,
    workerNumTimeout = 1000,
    workerNumTimer;

function watchTree(root, options, callback) {
    var argLen = arguments.length,
        args = [root],
        defCallback = function(f, curr, prev) {
            if (typeof f != "object" || prev !== null || curr !== null) {
                clearTimeout(monitorTimer);
                monitorTimer = setTimeout(function() {
                    process.emit('FILE_CHANGE');
                }, monitorTimeout);
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

function printWorkerNum() {
    clearTimeout(workerNumTimer);
    workerNumTimer = setTimeout(function() {
        logger.console('Now the number of workers: ' + Object.keys(cluster.workers).length, true);
    }, workerNumTimeout);
}

function createWorker() {
    var worker = cluster.fork(),
        pid = worker.process.pid;

    worker.once('listening', function() {
        logger.console('Worker (PID) ' + pid + ' has started!');
        printWorkerNum();
    });
    worker.once('exit', function() {
        logger.console('Worker (PID) ' + pid + ' has stopped!');
        printWorkerNum();

        if (worker.restart || !worker.suicide) {
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
            killWorkers(null, false, function(){
                process.emit('EADDRINUSE', msg.msg);
                process.exit(0);
            });
        }
    });

    return worker;
}

function startWorkers(procNum, callback) {
    var totalNum = procNum,
        onComplete = function(worker) {};

    if (typeof callback == 'function') {
        onComplete = function(worker) {
            worker.once('listening', function() {
                if (--totalNum == 0) {
                    callback();
                }
            });
        };
    }

    while (procNum-- > 0) {
        onComplete(createWorker());
    }
}

function killWorkers(ids, restart, callback) {
    var worker,
        workerIds = ids || Object.keys(cluster.workers),
        totalNum = workerIds.length,
        _onComplete = function(worker) {
            return worker.once('message', function(msg) {
                if (msg.cmd == 'WORKER_FINISHED') {
                    worker.restart = restart;
                    worker.kill();
                }
            });
        },
        onComplete = _onComplete;

    if (typeof callback == 'function') {
        onComplete = function(worker) {
            return _onComplete(worker).once('exit', function() {
                if (--totalNum == 0) {
                    callback();
                }
            });
        };
    }

    workerIds.forEach(function(id) {
        worker = cluster.workers[id];
        // avoid repeat send
        if (worker && !worker.processing) {
            worker.processing = true;
            // notify worker process to finish it's processing
            onComplete(worker).send({
                cmd: 'FINISH_WORKER'
            });
        }
    });
}

function printConfigInfo() {
    // print config
    process.once('PRINT_CONFIG', function(config) {
        config.processNum = procNum;
        logger.console(require('util').inspect(config, {
            depth: 3
        }), true, 'CURRENT CONFIG');
    });
}

exports.start = function() {
    var packageInfo = require('../package.json'),
        minNodeVer = packageInfo.engines.node;

    // check node version
    if (!semver.satisfies(process.version, minNodeVer)) {
        logger.error('Please update your version of the node to ' + minNodeVer + ' or above!\n');
        process.exit(0);
        return;
    }

    // exit log
    process.on('exit', function() {
        logger.info('[SERVER EXIT]: pid =',  process.pid);
        logger.console();
    });
    // exception log
    process.on('uncaughtException', function(err) {
        logger.info('[SERVER UNCAUGHT EXCEPTION]: ', err);
        logger.console();
    });
    // exit server
    process.on('SIGINT', function() {
        logger.console();
        logger.console('Start closing workers, Pleast wait a moment......');
        logger.separator();
        killWorkers(null, false, function() {
            logger.separator();
            logger.console('Server has been closed!');
            logger.console();
            process.exit(0);
        });
    });
    // restart server
    process.on('FILE_CHANGE', function() {
        logger.console();
        logger.console('Start restarting workers, Pleast wait a moment......');
        logger.separator();
        killWorkers(null, true, printConfigInfo);
    });
    // port is in use
    process.once('EADDRINUSE', function(msg) {
        logger.console(msg);
    });

    // command arguments, get process number
    program.version(packageInfo.version);
    program.option('-n, --procNum <num>', 'Setting procNum, default use cpu numbers', parseInt);
    program.parse(process.argv);
    procNum = program.procNum || procNum;

    // start workers
    cluster.setupMaster({
        exec: __dirname + '/worker.js'
    });
    logger.console('Begin start Server, Please Wait...');
    printConfigInfo();
    startWorkers(procNum, function() {
        logger.console('Server has started, you can start browsing your website now!', true);
        logger.console('Watching directories: ' + watches.join(', '));
    });

    // start monitor file change
    watchTree(process.cwd());
};