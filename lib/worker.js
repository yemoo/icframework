var fs = require('fs'),
    path = require('path'),
    utils = require('./frameutil'),
    frameutil = require('./frameutil'),
    semver = require('semver'),
    program = require('commander'),
    logger, config;

global.icFrame = exports;

// 初始化框架基础数据

function initFrameConfig() {
    var packageInfo = require('../package.json'),
        minNodeVer = packageInfo.engines.node,
        envCfg = {};

    // command arguments, get process number
    program.version(packageInfo.version)
        .option('-p, --port <num>', 'Set portNum, default use config setting', parseInt)
        .option('-u, --uid <uid>', 'Set the user identity of the process. default use current user')
        .option('-g, --gid <gid>', 'Set the group identity of the process. default use current user group')
        .option('-e, --env <env>', 'Set environment, default use config setting')
        .option('-a, --app <appName>', 'Set app Name. default use "app_<process.pid>')
        .option('-n, --procNum <num>', 'Set procNum, default use cpu numbers', parseInt)
        .option('-c, --config <path>', 'Set config directory, default use "config" directory')
        .parse(process.argv);

    if (program.config) {
        envCfg.configpath = program.config;
    }
    if (program.env) {
        envCfg.env = program.env;
    }
    if (program.app) {
        envCfg.app = program.app;
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

    // icFrame扩展
    utils.mixin(exports, {
        version: '0.2.0',
        // 增加一些全局参数及数据
        SERVER: {
            startTime: Date.now()
        },
        requests: 0,
        utils: utils
    });

    exports.configUtil = require('./configutil');
    exports.config = config = exports.configUtil.baseConfig(envCfg);

    exports.logger = require('./logger');
    logger = exports.logger.getLogger();

    // check node version
    if (!semver.satisfies(process.version, minNodeVer)) {
        logger.error('Please update your version of the node to ' + minNodeVer + ' or above!\n');
        process.exit(0);
    }

    logger.info('==================================');
    logger.info('Begin start Server, Please Wait...');
    // 输出框架配置信息
    logger.info(['\n[CURRENT CONFIG]', new Array(81).join('-'), require('util').inspect(config, {
        depth: 4
    }), new Array(81).join('-')].join('\n'));

    // gearman 初始化
    exports.gearman = require('./gearman')(config.gearman);
}

// 设置框架运行用户

function initFrameBootUser() {
    if (process.setgid && config.gid) {
        try {
            process.setgid(config.gid);
        } catch (err) {
            logger.warn('Failed to set gid: ' + err);
        }
    }
    if (process.getuid && process.setuid) {
        try {
            process.setuid(config.uid);
        } catch (err) {
            logger.warn('Failed to set uid: ' + err);
        }
    }
}

// 初始化框架事件

function initFrameEvent() {
    // 新请求
    process.on('REQUEST_START', function() {
        exports.requests++;
    });
    // 请求处理完成
    process.on('REQUEST_END', function() {
        exports.requests--;
        if (exports.requests <= 0) {
            exports.requests = 0;
            process.emit('SERVER_FREE');
        }
    });
    // node异常事件
    process.on('uncaughtException', function(err) {
        exports.logger.getLogger('exception').fatal(err.stack);
    });

    function processExitSignal() {
        logger.info('Start close server, Pleast wait a moment......');
        stopServer();
    }
    // 收到退出信号
    process.on('SIGINT', processExitSignal);
    process.on('SIGTERM', processExitSignal);
    process.on('SIGHUP', processExitSignal);
    process.on('SIGQUIT', processExitSignal);
    process.on('SIGUSR1', processExitSignal);
    process.on('SIGUSR2', processExitSignal);
    // 服务退出事件
    process.on('exitprocess', function() {
        // 延迟0.1秒后再退出，以便完成一些回收工作
        setTimeout(function() {
            logger.info('Server[pid=' + process.pid + '] is stopped.');
            process.exit(0);
        }, 100);
    });
}


// 其他处理

function initOthers() {
    var memwatch = require('memwatch');
    memwatch.on('leak', function(info) {
        logger.warn(info);
    });
    setInterval(function() {
        memwatch.gc();
    }, 10000);
}

// 启动服务

function startServer() {
    var APP = exports.APP = require('./application'),
        app = exports.APP.app,
        server;

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
    exports.server = server;

    // 服务器处理超时
    // server.setTimeout(config.timeout, function() {
    //     process.emit('REQUEST_END');
    // });
    server.listen(config.port, config.hostname, function() {
        server.running = true;
        logger.info('Server(pid=' + process.pid + ') is already started.');
    });
    server.on('close', function() {
        server.running = false;
        exports.gearman.closeClients();
    });
    // server is running
    server.on('error', function(e) {
        if (e.code == 'EADDRINUSE') {
            logger.error('The Server may already run on ' + config.fullHostname + ', Please close it and try again...');
            process.emit('exitprocess');
        }
    });
}

// 停止服务

function stopServer() {
    var server = exports.server,
        forceServerExit = function() {
            clearTimeout(closeTimer);
            process.emit('exitprocess');
        }, closeTimer;

    // 停止处理新的请求
    server && server.running && server.close();

    // waiting all request process completed
    if (exports.requests <= 0) {
        forceServerExit();
    } else {
        process.once('SERVER_FREE', forceServerExit);
        closeTimer = setTimeout(forceServerExit, config.timeout);
    }
}

//exports.start = function() {
initFrameConfig();
initFrameBootUser();
initFrameEvent();
initOthers();
startServer();
//};