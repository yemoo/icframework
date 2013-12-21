// plugin: 每个请求都会进入，在router之前执行
var fs = require('fs'),
	path = require('path'),
	utils = icFrame.utils;

// 设置gearman错误代码map
icFrame.setGMError = function(errMap) {
    icFrame.gearmanError = utils.mixin({}, icFrame.gearmanError, errMap);
};

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
		require('./plugins/stat.js').apply(this, arguments);
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
		require('./plugins/submitjob.js').apply(this, arguments);
	},
	// 查看应用的相关日志
	'SHOW_LOG': function() {
		require('./plugins/showlog.js').apply(this, arguments);
	},
	// 重写render和renderView实现，处理服务端错误
	'RENDER': function(req, res, next) {
		require('./plugins/render.js').apply(this, arguments);
	}
};