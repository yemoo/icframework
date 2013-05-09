var fs = require('fs'),
    utils = require('utilities'),
    program = require('commander'),
    memwatch = require('memwatch'),
    configUtil = require('./configutil'),
    envCfg = {}, config, logger, gearman, app;

global.icFrame = exports;

program.option('-u, --uid <uid>')
    .option('-g, --gid <gid>')
    .option('-p, --port <num>')
    .option('-e, --env <env>')
    .option('-c, --config <path>')
    .parse(process.argv);

if (program.config) {
    envCfg.configpath = program.config;
}
if (program.env) {
    envCfg.env = program.env;
}
if (program.port) {
    envCfg.port = program.port;
}
if (program.uid) {
    envCfg.uid = program.uid;
}
if (program.gid) {
    envCfg.gid = program.gid;
}

// extend other global vars
utils.mixin(exports, {
    version: '0.1.0',
    require: require,
    utils: utils,
    memwatch: memwatch,
    configUtil: configUtil,
    config: config = configUtil.baseConfig(envCfg),
    logger: logger = require('./logger'),
    gearman: gearman = require('./gearman').init(config.gearman),
    submitJob: gearman.submitJob.bind(gearman),
});

// FOR PRETTY PRINT
var _config = (function() {
    var _config = utils.mixin({}, config, true);
    if (_config.session.store && typeof _config.session.store == 'function') {
        _config.session.store = _config.session.store.toString().replace(/\s+/g, ' ');
    }
    var engines = _config.view.engines;
    Object.keys(engines).forEach(function(key) {
        engines[key] = '[Function]';
    });
    return _config;
})();


if (process.setgid && config.gid) {
    console.log('Current gid: ' + process.getgid());
    try {
        process.setgid(config.gid);
        console.log('New gid: ' + process.getgid());
    } catch (err) {
        console.log('Failed to set gid: ' + err);
    }
}
if (process.getuid && process.setuid) {
    console.log('Current uid: ' + process.getuid());
    try {
        process.setuid(config.uid);
        console.log('New uid: ' + process.getuid());
    } catch (err) {
        console.log('Failed to set uid: ' + err);
    }
}

// PRINT CONFIG INFO
process.send({
    cmd: 'CONFIG_INFO',
    args: JSON.stringify(_config)
});

// =======================
//   memory leak process
// ======================= 
memwatch.on('leak', function(info) {
    logger.warn(info);
});
setInterval(function() {
    memwatch.gc();
}, 10000);


// ====================
//    Create Server
// ====================
exports.APP = require('./application');
app = exports.APP.app;
// If SSL options were given
if (config.ssl) {
    if (config.ssl.cert && config.ssl.key) {
        server = require('https').createServer({
            key: fs.readFileSync(config.ssl.key),
            cert: fs.readFileSync(config.ssl.cert)
        }, app);
    } else {
        logger.error('Cannot start server using SSL.' + 'Missing certificate or private key.');
    }
} else { // If neither SSL or SPDY options were given use HTTP
    server = require('http').createServer(app);
}

server.setTimeout(config.timeout);
// start server
server.listen(config.port, config.hostname, function() {
    server.running = true;
});
server.on('close', function() {
    server.running = false;
    gearman.closeClients();
});
// server is running
server.on('error', function(e) {
    if (e.code == 'EADDRINUSE') {
        process.send({
            cmd: 'EADDRINUSE',
            msg: 'The Server may already run on ' + config.fullHostname + ', Please close it and try again...'
        });
    }
});

// ============================================
//  count total request and processing request
// ============================================
var requestTotal = 0,
    requestProcessing = 0;

process.on('REQUEST_START', function() {
    requestTotal++;
    requestProcessing++;
});
process.on('REQUEST_END', function() {
    requestProcessing--;
    if (requestProcessing <= 0) {
        requestProcessing = 0;
        process.emit('SERVER_FREE');
    }
});

// =================================
//  Custer/Worer Message dispatcher
// ================================= 
var closeTimer,
notifyFinished = function() {
    clearTimeout(closeTimer);
    process.send({
        cmd: 'WORKER_FINISHED'
    });
};
//console.log(server.getConnections());
process.on('message', function(msg) {
    if (msg.cmd == 'FINISH_WORKER') {
        // stop accepting new connections
        server.running && server.close();

        // waiting all request process completed
        if (requestProcessing <= 0) {
            notifyFinished();
        } else {
            process.once('SERVER_FREE', notifyFinished);
            closeTimer = setTimeout(notifyFinished, config.timeout);
        }
    }
});

// ==============================
//  Process worker state and Log
// ==============================
// WARN: don't delete this listener
process.on('SIGINT', function() {});
// worker exit and exception log
process.on('exit', function() {
    logger.info('[WORKER EXIT]: pid=' + process.pid);
});
process.on('uncaughtException', function(err) {
    logger.info('[WORKER UNCAUGHT EXCEPTION]: pid=' + process.pid + ', ' + err);
});