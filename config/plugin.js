// plugin: 每个请求都会进入，在router之前执行
var fs = require('fs'),
	path = require('path');

module.exports = {
	'DEF_INDEX': function(req, res, next) {
		// 默认首页
		if (req.path == '/index' && icFrame.APP._getUrlConfig('/index').notfound) {
			res.end('Server is Running!');
		} else {
			next();
		}
	},
	// gearman work调用统计
	'STAT': function(req, res, next) {
		var statFilter = require('./plugins/stat.js');
		if (req.path == '/stat') {
			statFilter.apply(this, arguments);
		} else {
			next();
		}
	},
	'HA_FILE': function(req, res, next) {
		if (req.path == '/ha.txt') {
			res.end('server is running');
		} else {
			next();
		}
	},
	'CROSS_DOMAIN_XML': function(req, res, next) {
		var file = path.join(icFrame.config.ctrlpath, 'crossdomain.xml');
		if (req.path == '/crossdomain.xml' && fs.existsSync(file)) {
			res.sendfile(file);
		} else {
			next();
		}
	},
	'GEARMAM_INTERFACE': function(req, res, next) {
		req.submitJob = require('./plugins/submitjob.js')
		next();
	},
	// 查看应用的相关日志
	'SHOW_LOG': (function() {
		var logconfig = icFrame.config.log || {},
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

		return function(req, res, next) {
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
	})()
};