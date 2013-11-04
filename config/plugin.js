// plugin: 每个请求都会进入，在router之前执行
var fs = require('fs'),
	path = require('path');
module.exports = {
	'DEF_INDEX': function(req, res, next) {
		// 默认首页
		var index = icFrame.APP._getUrlConfig('/index');
		if (index.notfound) {
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
	'GEARMAM_INTERFACE': function(req, res, next){
		req.submitJob = require('./plugins/submitjob.js')
		next();
	}
}