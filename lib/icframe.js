var division = require('division'),
	cluster = new division(),
	// 默认30s 超时
	timeout = 300000,
	// 默认读取cpu数
	autoSize = cluster.get('size'),
	// 默认单进程
	size = 1;

cluster.set('args', process.argv.slice(2))
	.set('path', __dirname + '/worker.js')
	.set('size', size).use('signals');

exports.start = function() {
	cluster.run(function() {
		var master = this;
		console.log('icFramework started at ' + new Date(master.startup) + ' with pid=' + master.pid);
		master.on('fork', function(worker) {
			worker.publish('start');
			worker.instance.on('message', function(msg) {
				var data = msg.data,
					offset = 0,
					procNum;

				if (msg.event == 'config') {
					// 超时时间设置
					if (timeout !== data.timeout) {
						cluster.set('timeout', timeout = data.timeout);
					}
					// 进程数设置
					if (size !== data.procNum) {
						procNum = data.procNum == 'auto' ? autoSize : (parseInt(data.procNum) || size);

						offset = procNum - size;
						if (offset > 0) {
							master.increase(offset);
						} else if (offset < 0) {
							master.decrease(-offset);
						}

						size = data.procNum;
					}
				} else if (msg.event == 'exit') {
					process.exit();
				}
			});
		});
	});
}