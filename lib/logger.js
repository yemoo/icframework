var log4js = require('log4js'),
    utils = require('./frameutil'),
    _logConfig = icFrame.config.log,
    logConfig = utils.mixin({}, _logConfig, true),
    appenders = logConfig.config && logConfig.config.appenders,
    appender;

// 不覆盖默认配置信息，只转化filename中的变量
logConfig.config.appenders = [];
// 必须是objet格式，不支持数组格式
if (appenders && !Array.isArray(appenders)) {
    Object.keys(appenders).forEach(function(key) {
        appender = appenders[key];
        if (!appender || typeof appender !== 'object') {
            return;
        }
        appender.category = appender.category || key;
        if (appender.filename) {
            _logConfig.config.appenders[key].filename = appender.filename = appender.filename.replace(/\{(\w+)\}/g, function(o, a) {
                return icFrame.config[a] || '';
            });
        }
        logConfig.config.appenders.push(appender);
    });
}

log4js.configure(logConfig.config, logConfig.options);

module.exports = log4js;