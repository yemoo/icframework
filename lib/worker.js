var fs = require('fs'),
    path = require('path'),
    utils = require('./frameutil'),
    frameutil = require('./frameutil'),
    semver = require('semver'),
    program = require('commander'),
    logger, exceptionLogger, config, closeTimer;

global.icFrame = exports;

// 发送消息给父进程
function send2Master(msg) {
    process.send && process.send(msg);
}

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
    if (program.procNum) {
        procNum = program.procNum;
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
    exceptionLogger = exports.logger.getLogger('exception');

    // check node version
    if (!semver.satisfies(process.version, minNodeVer)) {
        logger.error('Please update your version of the node to ' + minNodeVer + ' or above!\n');
        send2Master({
            event: 'exit'
        });
        process.exit(0);
    }

    logger.info('=========================== Server Init ===========================');
    logger.info('Begin start Server(pid=' + process.pid + '), Please Wait...');
    // 输出框架配置信息
    logger.info(['\n[CURRENT CONFIG]', new Array(81).join('-'), require('util').inspect(config, {
        depth: 4
    }), new Array(81).join('-')].join('\n'));

    // 配置信息发给主进程（仅在使用cluster时使用）
    send2Master({
        event: 'config',
        data: config
    });

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
        exceptionLogger.fatal(err.stack);
    });

    // 通过信号关闭进程

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
}


// 其他处理

function initOthers() {
    var memwatch = require('memwatch');
    memwatch.on('leak', function(info) {
        exceptionLogger.warn(info);
    });
    setInterval(function() {
        memwatch.gc();
    }, 10000);
}


// 启动socket server
function initSocketServer(socketConfig) {
    var handlepath = socketConfig.handlepath,
        io;

    function doConnection(handler, name) {
        var socket;

        name = (name || 'default');
        socket = name !== 'default' ? io.of(name) : io.sockets;
        socket.on('connection', function(socket) {
            logger.info('socket server' + name + ' has connected!')
            socket.emit('server connect');
            handler(socket);
            socket.on('disconnect', function() {
                logger.info('socket server' + name + ' has disconnect!')
                socket.emit('server disconnect');
            });
        });
    }

    if (socketConfig.run) {
        io = require('socket.io').listen(socketConfig.port || exports.server, socketConfig.options);
        fs.readdir(handlepath, function(err, files) {
            if (err) {
                exceptionLogger.warn(err);
                return;
            }

            files.forEach(function(file) {
                var name = path.basename(file, '.js'),
                    handler = require(path.join(handlepath, file));

                name = (name === 'index' ? 'default' : ('/' + name));
                if (typeof handler === 'function') {
                    doConnection(handler, name);
                    logger.info('socket [' + name + '] init success!')
                } else {
                    logger.warn('socket [' + name + '] init failed! file ' + file + ' isn\'t a valid socket handler!')
                }
            });
        });
    }
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
    // 初始化socket服务
    initSocketServer(config.socket);

    server.listen(config.port, config.hostname, function() {
        server.running = true;
        logger.info('Server(pid=' + process.pid + ') is already started.');
    });
    server.on('close', function() {
        server.running = false;
        exports.gearman.closeClients();
        killProcess();
    });
    // server is running
    server.on('error', function(e) {
        if (e.code == 'EADDRINUSE') {
            logger.error('The Server may already run on ' + config.fullHostname + ', Please close it and try again...');
            killProcess();
        }
    });
}

// 停止服务

function stopServer() {
    var server = exports.server;

    // 停止处理新的请求
    server && server.running && server.close();

    // waiting all request process completed
    if (exports.requests <= 0) {
        killProcess();
    } else {
        process.once('SERVER_FREE', killProcess);
        closeTimer = setTimeout(killProcess, config.timeout);
    }
}

// 强制关闭进程

function killProcess() {
    clearTimeout(closeTimer);
    logger.info('Server(pid=' + process.pid + ') is stopped.');
    send2Master({
        event: 'exit'
    });
    process.exit(0);
}

exports.start = function() {
    initFrameConfig();
    initFrameBootUser();
    initFrameEvent();
    initOthers();
    startServer();
};

// 收到主进程start信号，自动启动服务
process.on('message', function(msg) {
    (msg.event === 'start') && exports.start()
});