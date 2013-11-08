var GMLOGGER = {
	timer: null,
	// 存储几段日志历史
	logSegments: 1,
	// 处理中jobs
	queue: {},
	// 当前已经处理完成的jobs
	curr: {},
	// 已经存档的jobs
	logs: [],
	// 多长时间做一次存档
	delay: 5 * 60 * 1000,
	init: function(options) {
		this.init = function() {
			return this;
		};

		this.timer = new Date();
		// 每隔一段时间写日志
		setInterval(this.saveLog, this.delay);
		return this;
	},
	getData: function(type) {
		return this[type || 'logs'] || {
			err: '未知数据'
		};
	},
	createKey: function(key) {
		// 每个job调用加上时间戳|pid|uuid，避免同时调用同一个job时导致记录错误
		return [key, new Date().getTime(), process.pid, icFrame.utils.string.uuid()].join('|');
	},
	// 获取一个key的信息
	getKeyInfo: function(key) {
		if (key) {
			key = key.split('|');
			return {
				name: key[0],
				startTime: key[1],
				pid: key[2]
			};
		} else {
			return {
				name: 'INVALID'
			};
		}
	},
	// 开始调用一个job
	start: function(key) {
		this.init().queue[key] = true;
	},
	// 完成, failure表示失败
	complete: function(key, failure, ioInfo) {
		var self = GMLOGGER,
			curr = self.curr,
			queue = self.queue,
			info = self.getKeyInfo(key),
			name = info.name,
			startTime = info.startTime,
			runTime = new Date().getTime() - startTime;

		// submitjob未注册的直接忽略
		if (!queue[key]) return;
		delete queue[key];

		if (!curr[name]) {
			curr[name] = {
				name: name,
				callTimes: 1,
				failureTimes: failure ? 1 : 0,
				runTime: runTime,
				request: ioInfo.request,
				response: ioInfo.response
			};
		} else {
			curr[name].callTimes += 1;
			if (failure) {
				curr[name].failureTimes += 1;
			} else {
				curr[name].runTime += runTime;
				curr[name].request += ioInfo.request;
				curr[name].response += ioInfo.response;
			}
		}
	},
	saveLog: function() {
		var self = GMLOGGER,
			logSegments = self.logSegments,
			now = new Date(),
			data = self.curr,
			prevTimer = self.timer;

		self.curr = {};
		self.timer = now;

		// data = Object.keys(data).map(function(name) {
		//     return data[name];
		// });
		if (logSegments < 1) {
			return
		} else if (logSegments == 1) {
			self.logs = {
				startTime: prevTimer,
				endTime: now,
				data: data
			};
		} else {
			self.logs.push({
				startTime: prevTimer,
				endTime: now,
				data: data
			});

			while (self.logs.length > logSegments) {
				self.logs.shift();
			}
		}
	}
}, submitJob = icFrame.gearman.submitJob;

icFrame.gearman.submitJob = function(fname, request, options) {
	var jobName = [fname],
		optType = typeof options,
		callback,
		_callback,
		isOptCallback,
		jobKey;

	// 有回调函数才执行日志记录
	if (optType == 'function') {
		callback = options;
	} else if (optType == 'object' && !options.background && typeof options.callback == 'function') {
		callback = options.callback;
		isOptCallback = true;
	}

	if (callback) {
		request.c && jobName.push(request.c);
		request.m && jobName.push(request.m);
		jobName = jobName.join('.').replace(/__/g, '.');
		jobKey = GMLOGGER.createKey(jobName);

		_callback = function(payload) {
			// data.err_no < 0: 调用失败
			GMLOGGER.complete(jobKey, !payload.response || payload.response.err_no < 0, {
				request: Buffer.byteLength(JSON.stringify(request)),
				response: Buffer.byteLength(JSON.stringify(payload))
			});

			callback.apply(this, arguments);
		}

		if (isOptCallback) {
			options.callback = _callback;
		} else {
			options = _callback;
		}

		GMLOGGER.start(jobKey);
	}
	return submitJob.call(icFrame.gearman, fname, request, options);
};

module.exports = function(req, res, next) {
	if (req.path == '/stat') {
		res.json(GMLOGGER.getData(req.param('type')));
	} else {
		next();
	}
};