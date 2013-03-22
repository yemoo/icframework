var winston = require('winston');

// only support logPath
// TODO: support more config
var logger = {
	init: function(options) {
		var opts = (options || {}),
			logPath = options.logPath;

		var transports = [new(winston.transports.Console)({
			json: false,
			timestamp: true
		})],
			exceptionHandlers = [new(winston.transports.Console)({
				json: false,
				timestamp: true
			})];

		if (logPath) {
			transports.push(new winston.transports.File({
				filename: logPath + '/debug.log',
				json: false
			}));

			exceptionHandlers.push(new winston.transports.File({
				filename: logPath + '/exceptions.log',
				json: false
			}));
		}
		return new(winston.Logger)({
			transports: transports,
			exceptionHandlers: exceptionHandlers,
			exitOnError: false
		});
	}
}


module.exports = logger;