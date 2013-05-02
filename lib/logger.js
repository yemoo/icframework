var winston = require('winston'),
    utils = require('utilities'),
    configUtil = require('./configutil'),
    logger = new(winston.Logger)({
        transports: [new winston.transports.Console],
        exceptionHandlers: [new winston.transports.Console],
        exitOnError: false
    }),
    _log = logger.log;


utils.mixin(logger, {
    log: function(msg) {
        // logger.log('this is a message');
        if (arguments.length == 1) {
            logger.info(arguments[0]);
        } else {
            // logger.log('warn|info|error', 'this is a message');
            _log.apply(logger, arguments);
        }
    },
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

configUtil.loadConfig(logger, 'logger');

if(logger.__INIT__){
    Object.keys(logger.__INIT__).forEach(function(key){
        logger.__INIT__[key].call(logger, winston);
    });
}

module.exports = logger;