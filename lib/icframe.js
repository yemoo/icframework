var division = require('division'),
	cluster = new division(),
	// 默认30s 超时
	timeout = 300000,
	autoSize = cluster.get('size'),
	// 默认单进程
	size = 1;

cluster.set('args', process.argv.slice(2))
	.set('path', __dirname + '/worker.js')
	.set('size', size).use('signals');

exports.start = function() {
	cluster.run(function() {
		var master = this;
		master.on('fork', function(worker) {
			worker.publish('start');
			worker.instance.on('message', function(msg) {
				var data = msg.data,
					procNum;

				if (msg.event == 'config') {
					// 超时时间设置
					if (timeout !== data.timeout) {
						cluster.set('timeout', timeout = data.timeout);
					}
					// 进程数设置
					if (size !== data.procNum) {
						procNum = data.procNum == 'auto' ? autoSize : parseInt(data.procNum);
						master.increase(procNum - size);
						size = data.procNum;
					}
				} else if (msg.event == 'exit') {
					process.exit();
				}
			});
		});
	});
}