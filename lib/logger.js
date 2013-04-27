var winston = require('winston'),
    fs = require('fs'),
    utils = require('utilities'),
    configUtil = require('./configutil'),
    logger;

// Must be export: log/info/warn/error... method
var defaultLogger = function() {
    var winston = require('winston'),
        logDir = process.cwd() + '/log/',
        // default debug path and exception path
        logFile = logDir + '/debug.log',
        exceptionFile = logDir + '/exceptions.log';

    var transports = [new(winston.transports.Console)({
        json: false,
        timestamp: true
    })],
        exceptionHandlers = [new(winston.transports.Console)({
            json: false,
            timestamp: true
        })];

    if (fs.existsSync(logFile)) {
        transports.push(new winston.transports.File({
            filename: logFile,
            json: false
        }));
    }
    if (fs.existsSync(exceptionFile)) {
        exceptionHandlers.push(new winston.transports.File({
            filename: exceptionFile,
            json: false
        }));
    }

    return new(winston.Logger)({
        transports: transports,
        exceptionHandlers: exceptionHandlers,
        exitOnError: false
    });
}

logger = defaultLogger();
logger._log = logger.log;
// compatible for logger.log(msg) calling
logger.log = function(msg) {
    // logger.log('this is a message');
    if (arguments.length == 1) {
        logger.info(arguments[0]);
    } else {
        // logger.log('warn|info|error', 'this is a message');
        logger._log.apply(logger, arguments);
    }
}

configUtil.loadConfig(logger, 'logger');

// add console method
if (!logger.console) {
    utils.mixin(logger, {
        console: function(msg, separator, title) {
            var sepNum = typeof separator == 'number' ? separator : '';
            if (msg != undefined && msg !== '') {
                separator && this.separator(sepNum);
                if (title) {
                    console.log('[' + title + ']');
                    console.log(new Array(title.length + 4).join('='));
                }
                console.log(msg);
                separator && this.separator(sepNum);
            } else {
                console.log();
            }
        },
        separator: function(num) {
            num = num || 80;
            console.log(new Array(num).join('-'));
        }
    });
}

module.exports = logger;