var cluster = require('cluster');

// create global icFrame Object
global.icFrame = exports;

exports.version = '0.0.1';
exports.utils = require('../node_modules/express/node_modules/connect/lib/utils');

// [ref]: geddy worker.js
exports.createServer = function() {
    var ssl = this.config.ssl;
    // If SSL options were given
    if (ssl) {
        if (ssl.cert && ssl.key) {
            this.server = require('https').createServer({
                key: fs.readFileSync(ssl.key),
                cert: fs.readFileSync(ssl.cert)
            }, this.app);
        } else {
            this.logger.error('Cannot start server using SSL.' + 'Missing certificate or private key.');
        }
    } else { // If neither SSL or SPDY options were given use HTTP
        this.server = require('http').createServer(this.app);
    }
    return this.server;
};

function logSplitline(){
    console.log('------------------------------------------------------');
}

exports.start = function() {
    var config = exports.config = require('./config').readConfig(),
        app = exports.app = require('./application').init(config),
        log = exports.logger = require('./logger').init(config),
        gearman = exports.gearman = require('./gearman'),
        clog = console.log,
        workers = [];

    exports.submitJob = function(){
        gearman.submitJob.apply(gearman, arguments);
    };

    if (cluster.isMaster) {
        var i = 0,
            started = 0,
            worker;

        clog('Begin start Servers, Please Wait...');

        logSplitline();
        clog(JSON.stringify(config));
        logSplitline();

        for (; i < config.processNum; i++) {
            worker = cluster.fork();
            workers.push(worker);
            clog('Starting Worker (PID): ' + worker.process.pid);
        }

        logSplitline();
        // cluster started
        cluster.on('listening', function(worker) {
            clog('Server worker running in ' + config.environment + ' on port ' + config.port + (config.ssl ? ' (SSL)' : '') + ' with a PID of: ' + worker.process.pid);
            if (config.processNum == ++started) {
                logSplitline();
                clog('All Servers had Started, you can start explore you website now!');
            }
        });
        // cluster exit
        cluster.on('exit', function(worker) {
            var tmpWorker, info = 'Worker (PID) ' + worker.process.pid + ' has stopped! ';
            for (i = 0; i < workers.length; i++) {
                tmpWorker = workers[i];
                if (worker.process.pid === tmpWorker.process.pid) {
                    workers.splice(i, 1);
                    clog(info + 'Left Workers Num: ' + workers.length);
                }
            }
        });

        // process exit kill all workers
        process.on('SIGINT', function() {
            // echo a blank line
            clog();
            for (i = 0; i < workers.length; i++) {
                workers[i].kill();
            }
            //icFrame.gearman.closeClients();
        });
    } else {
        // start server
        this.createServer().listen(config.port, config.hostname);
    }
}