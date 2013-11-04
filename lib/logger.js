var log4js = require('log4js'),
    utils = require('./frameutil'),
    logCfg = icFrame.config.log || {},
    appenders = logCfg.config && logCfg.config.appenders,
    _appenders = [],
    appender;

if (appenders) {
    if (!Array.isArray(appenders)) {
        Object.keys(appenders).forEach(function(key) {
            appender = appenders[key];
            if (!appender || typeof appender !== 'object') {
                return;
            }
            appender.category = appender.category || key;
            if (appender.filename) {
                appender.filename = appender.filename.replace(/\{(\w+)\}/g, function(o, a) {
                    return icFrame.config[a] || '';
                });
            }
            _appenders.push(appender);
        });
        logCfg.config.appenders = _appenders;
    } else {
        logCfg.config.appenders = JSON.parse(JSON.stringify(appenders).replace(/\{(\w+)\}/g, function(o, a) {
            return icFrame.config[a] || '';
        }));
    }
}

log4js.configure(logCfg.config, logCfg.options);

module.exports = log4js;