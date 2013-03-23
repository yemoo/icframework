var fs = require('fs'),
	utils = require('utilities'),
	configPath = icFrame.config.configPath,
	appLogConfig = configPath + '/logger' + '.js',
	logger;

// Must be export: log/info/warn/error... method
var defaultLogger = function() {
	var winston = require('winston'),
		logPath = process.cwd() + '/log/',
		// default debug path and exception path
		logFile = logPath + '/debug.log',
		exceptionFile = logPath + '/exceptions.log';

	if (fs.existsSync(logFile)) {
		winston.add(winston.transports.File, {
			filename: logFile
		});
	}
	if (fs.existsSync(exceptionFile)) {
		winston.handleExceptions(new winston.transports.File({
			filename: exceptionFile
		}));
	}
	return winston;
}

logger = defaultLogger();
if (fs.existsSync(appLogConfig)) {
	utils.mixin(logger, require(appLogConfig));
}

// add console method
if (!logger.console) {
	utils.mixin(logger, {
		console: function(msg, separator) {
			var sepNum = typeof separator == 'number' ? separator : '';
			if (msg != undefined && msg !== '') {
				separator && this.separator(sepNum);
				console.log(msg);
				separator && this.separator(sepNum);
			} else {
				console.log();
			}
		},
		separator: function(num) {
			num = num || 40;
			console.log(new Array(num).join('-'));
		}
	});
}

module.exports = logger;