/*jshint bitwise:false */
var fs = require('fs'),
	utils = require('utilities'),
	mtimeCache = {};

utils.frame = {
	ip2long: function(IP) {
		// http://kevin.vanzonneveld.net
		// +   original by: Waldo Malqui Silva
		// +   improved by: Victor
		// +    revised by: fearphage (http://http/my.opera.com/fearphage/)
		// +    revised by: Theriault
		// *     example 1: ip2long('192.0.34.166');
		// *     returns 1: 3221234342
		// *     example 2: ip2long('0.0xABCDEF');
		// *     returns 2: 11259375
		// *     example 3: ip2long('255.255.255.256');
		// *     returns 3: false
		var i = 0;
		// PHP allows decimal, octal, and hexadecimal IP components.
		// PHP allows between 1 (e.g. 127) to 4 (e.g 127.0.0.1) components.
		IP = IP.match(/^([1-9]\d*|0[0-7]*|0x[\da-f]+)(?:\.([1-9]\d*|0[0-7]*|0x[\da-f]+))?(?:\.([1-9]\d*|0[0-7]*|0x[\da-f]+))?(?:\.([1-9]\d*|0[0-7]*|0x[\da-f]+))?$/i); // Verify IP format.
		if (!IP) {
			return false; // Invalid format.
		}
		// Reuse IP variable for component counter.
		IP[0] = 0;
		for (i = 1; i < 5; i += 1) {
			IP[0] += !! ((IP[i] || '').length);
			IP[i] = parseInt(IP[i]) || 0;
		}
		// Continue to use IP for overflow values.
		// PHP does not allow any component to overflow.
		IP.push(256, 256, 256, 256);
		// Recalculate overflow of last component supplied to make up for missing components.
		IP[4 + IP[0]] *= Math.pow(256, 4 - IP[0]);
		if (IP[1] >= IP[5] || IP[2] >= IP[6] || IP[3] >= IP[7] || IP[4] >= IP[8]) {
			return false;
		}
		return IP[1] * (IP[0] === 1 || 16777216) + IP[2] * (IP[0] <= 2 || 65536) + IP[3] * (IP[0] <= 3 || 256) + IP[4] * 1;
	},
	ipToNum: function($ip) {
		var $n = utils.frame.ip2long($ip);

		/** convert to network order */
		$n = (($n & 0xFF) << 24) | ((($n >> 8) & 0xFF) << 16) | ((($n >> 16) & 0xFF) << 8) | (($n >> 24) & 0xFF);
		return $n;
	},
	getIPAddress: function() {
		var ignoreRE = /^(127\.0\.0\.1|::1|fe80(:1)?::1(%.*)?)$/i,
			ifaces = require('os').networkInterfaces();

		for (var dev in ifaces) {
			for (var i = 0, l = ifaces[dev].length, details; i < l; i++) {
				details = ifaces[dev][i];
				if (details.family === 'IPv4' && !ignoreRE.test(details.address)) {
					return details.address;
				}
			}
		}
		return '';
	},
	// 获取一个时间戳
	timestamp: function(tm) {
		var timezone = 8;
		return new Date(tm + timezone * 60 * 60 * 1000).toISOString().split('.')[0].replace(/[-T:]/g, '').substr(0, 12);
	},
	// 异步调用
	asyncRun: function(parallelCallbacks, callback, context, args) {
		var total = parallelCallbacks.length,
			cur = 0,
			done = function(err) {
				if (err) {
					callback(err);
				} else {
					if (++cur == total) {
						callback();
					}
				}
			};
		if (args && Array.isArray(args)) {
			args.concat([done]);
		} else {
			args = [done];
		}
		parallelCallbacks.forEach(function(fn) {
			fn.apply(context || null, args);
		});
	},
	// 判断元素类型
	getType: function(obj) {
		var type = Object.prototype.toString.call(obj);
		return type.substring(8, type.length - 1).toLowerCase();
	},
	isType: function(obj, type) {
		if (!type) {
			return false;
		}
		type = type.substr(0, 1).toUpperCase() + type.substr(1).toLowerCase();
		return Object.prototype.toString.call(obj) === '[object ' + type + ']';
	},
	require: function(file, clearcache) {
		return clearcache ? utils.frame.forcerequire(file) : require(file);
	},
	// 强制重新require文件，不使用缓存
	forcerequire: function(file) {
		var fullpath = require.resolve(file),
			mtime = fs.statSync(fullpath).mtime.getTime(),
			reload = mtime !== mtimeCache[fullpath];

		if (reload) {
			require.cache && (delete require.cache[fullpath]);
			mtimeCache[fullpath] = mtime;
		}
		return require(file);
	},
	// 捕获用户请求中回调函数的错误
	wrapReqCallback: function(fn) {
		return function(req, res) {
			try {
				return fn.apply(this, arguments);
			} catch (e) {
				req.next(e);
			}
		};
	}
};

module.exports = utils;