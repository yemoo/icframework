var fs = require('fs'),
    path = require('path'),
    cluster = require('cluster'),
    semver = require('semver'),
    program = require('commander'),
    logger = require('./logger'),
    watch = require('watch'),
    procNum = require('os').cpus().length,
    watches = [],
    ignorewatch,
    monitorTimeout = 1000,
    monitorTimer,
    workerNum,
    config;


function checkPath(_path) {
    _path = path.resolve(_path);
    return fs.existsSync(_path) ? _path : false;
}
// file change monitor

function filterWatch(f) {
    return ignorewatch ? ignorewatch.test(f) : false;
}

function defCallback(f, curr, prev) {
    if (typeof f != "object" || prev !== null || curr !== null) {
        // ignore watching: can't delete this line
        if (filterWatch(f)) return;

        clearTimeout(monitorTimer);
        monitorTimer = setTimeout(function() {
            process.emit('FILE_CHANGE');
        }, monitorTimeout);
    }
}

function watchTree(root, options, callback) {
    var isWatching = watches.some(function(dir) {
        var result = path.relative(dir, root);
        return (!result || !~result.indexOf('..'));
    });

    if (isWatching) return;

    watch.watchTree(root, {
        ignoreDotFiles: true,
        filter: filterWatch
    }, defCallback);
    watches.push(root);
}


function printWorkerNum() {
    var curWorkerNum = Object.keys(cluster.workers).length;
    if(workerNum != curWorkerNum){
        workerNum = curWorkerNum;
        logger.console('Now the number of workers: ' + workerNum, true);
    }
}

function createWorker(hideWorkerNum) {
    var worker = cluster.fork(),
        pid = worker.process.pid;

    worker.once('listening', function() {
        logger.console('Worker (PID) ' + pid + ' has started!');
        !hideWorkerNum && printWorkerNum();
    }).once('exit', function() {
        logger.console('Worker (PID) ' + pid + ' has stopped!');
        printWorkerNum();

        if (worker.restart || !worker.suicide) {
            createWorker();
        }
    }).on('message', function(msg) {
        var config;
        if (msg.cmd == 'CONFIG_INFO') {
            config = JSON.parse(msg.args);
            // print config info
            process.emit('CONFIG_LOAD', config);
        } else if (msg.cmd == 'EADDRINUSE') {
            process.emit('EADDRINUSE', msg.msg);
            worker.kill();
        }
    });

    return worker;
}

function startWorkers(procNum, callback) {
    var totalNum = procNum;

    while (procNum-- > 0) {
        createWorker(true).once('listening', function() {
            if (--totalNum == 0) {
                callback();
            }
        });
    }
}

function killWorkers(callback, restart) {
    var workerIds = Object.keys(cluster.workers),
        totalNum = workerIds.length;

    workerIds.forEach(function(id) {
        var worker = cluster.workers[id];
        // avoid repeat send
        if (worker && !worker.processing) {
            worker.processing = true;
            // notify worker process to finish it's processing
            worker.once('message', function(msg) {
                if (msg.cmd == 'WORKER_FINISHED') {
                    worker.restart = !! restart;
                    worker.kill();
                }
            }).once('exit', function() {
                if (--totalNum == 0) {
                    callback();
                }
            }).send({
                cmd: 'FINISH_WORKER'
            });
        }
    });
}

function onReload() {
    // print config
    process.once('CONFIG_LOAD', function(cfg) {
        var clusterHook;

        // add to global
        config = cfg;
        config.processNum = procNum;

        // set specify user to run process
        if (process.setgid && config.gid) {
            try {
                process.setgid(config.gid);
            } catch (err) {
                logger.console('Failed to set gid: ' + err);
            }
        }
        if (process.getuid && process.setuid) {
            try {
                process.setuid(config.uid);
            } catch (err) {
                logger.console('Failed to set uid: ' + err);
            }
        }

        // load user plugin
        clusterHook = config.configpath + '/cluster.js';
        if (fs.existsSync(clusterHook)) {
            clusterHook = require(clusterHook);
            if (clusterHook.init) {
                clusterHook.init(cluster, config);
                logger.console('cluster hook file load successful!');
            }
        }

        // print config
        logger.console(require('util').inspect(config, {
            depth: 3
        }), true, 'CURRENT CONFIG');

        // watch files
        ignorewatch = eval(config.ignorewatch);
        watchTree(process.cwd());
        watchTree(config.view.path);
        watchTree(config.ctrlpath);
        watchTree(config.configpath);
    });
}

// 启动入口
exports.start = function() {
    var packageInfo = require('../package.json'),
        minNodeVer = packageInfo.engines.node,
        workerArgs = [];

    // command arguments, get process number
    program.version(packageInfo.version)
        .option('-p, --port <num>', 'Set portNum, default use config setting', parseInt)
        .option('-u, --uid <uid>', 'Set the user identity of the process. default use current user')
        .option('-g, --gid <gid>', 'Set the group identity of the process. default use current user group')
        .option('-e, --env <env>', 'Set environment, default use config setting')
        .option('-n, --procNum <num>', 'Set procNum, default use cpu numbers', parseInt)
        .option('-c, --config <path>', 'Set config directory, default use "config" directory', checkPath)
        .parse(process.argv);

    if (program.config === false) {
        logger.console('Sorry, config path is not valid! auto use default config path', true);
    }
    if (program.procNum) {
        procNum = program.procNum;
    }
    if (program.config) {
        workerArgs.push('-c', program.config);
    }
    if (program.port) {
        workerArgs.push('-p', program.port);
    }
    if (program.env) {
        workerArgs.push('-e', program.env);
    }
    if (program.uid) {
        workerArgs.push('-u', program.uid);
    }
    if (program.gid) {
        workerArgs.push('-g', program.gid);
    }

    // check node version
    if (!semver.satisfies(process.version, minNodeVer)) {
        logger.error('Please update your version of the node to ' + minNodeVer + ' or above!\n');
        process.exit(0);
        return;
    }

    // exit log
    process.on('exit', function() {
        logger.info('[SERVER EXIT]: pid =', process.pid);
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
        killWorkers(function() {
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
        killWorkers(onReload, true);
    });
    // port is in use
    process.once('EADDRINUSE', function(msg) {
        // exit the cluster
        cluster.on('exit', function() {
            if (Object.keys(cluster.workers).length == 0) {
                logger.console(msg, true);
                process.exit(0);
            }
        });
    });

    onReload();

    // start workers
    cluster.setupMaster({
        exec: __dirname + '/worker.js',
        args: workerArgs,
    });
    logger.console('Begin start Server, Please Wait...');

    startWorkers(procNum, function() {
        printWorkerNum();
        logger.console('Watching directories: ' + watches.join(', '));
        logger.console('Server is running at [' + config.fullHostname + ']', true);
    });
};