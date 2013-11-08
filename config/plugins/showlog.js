var fs = require('fs'),
	path = require('path'),
	logconfig = icFrame.config.log || {},
	logurl = logconfig.url || '/showmethelog',
	cwd = logconfig && logconfig.options && logconfig.options.cwd || '',
	loglistHTML = 'Sorry, no log config info in config!',
	logfiles = [];

if (logconfig && logconfig.config && logconfig.config.appenders) {
	loglistHTML = Object.keys(logconfig.config.appenders).map(function(key) {
		var appender = logconfig.config.appenders[key],
			filename = appender.filename;
		return ((appender.type == 'file') && filename) ? ('<a href="' + logurl + '?logfile=' + filename + '" target="_blank">' + filename + '</a><br>') : '';
	}).join('') || 'Sorry, no file appenders in logconfig!';
}

module.exports = function(req, res, next) {
	var logfile = req.param('logfile');
	if (req.path == logurl) {
		if (!logfile) {
			res.send(loglistHTML);
		} else {
			logfile = path.join(cwd, logfile);
			if (fs.existsSync(logfile)) {
				res.download(logfile);
			} else {
				res.send('Sorry, log file not found!');
			}
		}
	} else {
		next();
	}
};