var Gearman = require('./node-gearman').Gearman;

// assume all server support all jobs
GearmanManager = {
	init: function() {
		this.gearmanConfig = require(icFrame.config.configPath + '/gearman');
		this.jobStack = [];
		this.curServerNum = 0;

		this.clientNum = 0;
		this.clients = [];
		this.busyClients = [];

		this.initGearmanClient();
	},
	getServerInfo: function() {
		var servers = this.gearmanConfig.server,
			num = servers.length;

		return servers[this.curServerNum++ % num];
	},
	initGearmanClient: function() {
		var initClientNum = this.gearmanConfig.initClientNum;

		for (var i = 0; i < initClientNum; i++) {
			this.clients.push(this.createNewClient());
		}
	},
	createNewClient: function() {
		var self = this,
			maxClientNum = this.gearmanConfig.maxClientNum,
			server, client;

		if (this.clientNum < maxClientNum) {
			server = this.getServerInfo(),
			client = new Gearman(server.ip, server.port);
			client.on('WORK_COMPLETE', function(job) {
				var args = [].slice.call(arguments, 0);
				// add client reference
				args.unshift(this);
				self._workComplete.apply(self, args);
			});

			client.connect(function(){});
			this.clientNum++;

			return client;
		}
		return false;
	},
	_workComplete: function() {
		var args = [].slice.call(arguments, 0),
			client = args.shift(),
			callback = client.callback,
			index = this.busyClients.indexOf(client);

		callback.apply(client, args);

		this.busyClients.splice(index, 1);
		delete client.callback;
		clearTimeout(client.timer);
		delete client.timer;
		this.clients.push(client);

		// if client is free, start process jobs
		if (this.clientBusy) {
			this.clientBusy = false;
			this.processJob();
		}
	},
	processJob: function(job) {
		if (job) {
			var freeClient = this.getFreeClient(),
				// global timeout time
				timeout = this.gearmanConfig.timeout;

			if (freeClient) {
				this.busyClients.push(freeClient);
				// add job callback reference
				freeClient.callback = job.callback;
				freeClient.submitJob.apply(freeClient, job.args);

				// timeout: 10s
				freeClient.timer = setTimeout(function() {
					freeClient.callback.call(freeClient, {
						error: true,
						payload: 'gearman job "' + job.args[0] + '" request timeout(maxTimeout ' + timeout + 'ms!)'
					});
				}, timeout);
			} else { // when client busy add to stacks
				this.jobStack.push(job);
				this.clientBusy = true;
			}
		} else {
			// pop out a job
			while (!this.clientBusy && job = this.jobStack.shift()) {
				this.processJob(job);
			}
		}
	},
	getFreeClient: function() {
		if (this.clients.length) {
			return this.clients.shift();
		} else {
			return this.createNewClient();
		}
	},
	submitJob: function() {
		var args = [].slice.call(arguments, 0),
			callback = args[args.length - 1], // if last arguments is function ,consider it as callback
			job = {
				args: args,
				callback: function() {}
			};

		if (typeof callback == 'function') {
			job.callback = args.pop();
		}

		this.processJob(job);
	},
	closeClients: function() {
		var client;
		while (client = this.clients.pop()) {
			client.close();
		}
		while (client = this.busyClients.pop()) {
			client.close();
		}
	}
}

GearmanManager.init();
module.exports = GearmanManager;
