var fs = require('fs'),
    Gearman = require('./node-gearman').Gearman;

// assume all server support all jobs
GearmanManager = {
    init: function() {
        // no config file, don't init gearman service
        if (fs.existsSync(icFrame.config.configDir + '/gearman' + '.js')) {
            this.gearmanConfig = require(icFrame.config.configDir + '/gearman');
            this.inited = true;
        } else {
            this.inited = false;
        }

        this.jobStack = [];
        this.curServerNum = 0;

        this.clientNum = 0;
        this.clients = [];
        this.busyClients = [];

        this.inited && this._initGearmanClient();
    },
    _initGearmanClient: function() {
        var clientNum = this.gearmanConfig.clientNum,
            i = 0,
            newClient;

        for (; i < clientNum; i++) {
            newClient = this.createNewClient();
            newClient && this.clients.push(newClient);
        }
    },
    getServer: function() {
        var servers = this.gearmanConfig.server,
            num = servers.length;

        return servers[this.curServerNum++ % num] || {};
    },
    createNewClient: function() {
        var self = this,
            maxClientNum = this.gearmanConfig.maxClientNum,
            server, client;

        if (this.inited && this.clientNum < maxClientNum) {
            server = this.getServer();

            if (server) {
                client = new Gearman(server.ip, server.port);
                client.on('WORK_COMPLETE', function(job) {
                    var args = [].slice.call(arguments, 0);
                    // add client reference
                    args.unshift(this);
                    self._workComplete.apply(self, args);
                });
                client.connect(function() {});
                self.clientNum++;

                return client;
            }
            return false;
        }
        return false;
    },
    // find a client from the freeclients stack
    // or 
    // create a new client
    getFreeClient: function() {
        if (this.clients.length) {
            return this.clients.shift();
        } else {
            return this.createNewClient();
        }
    },
    _workComplete: function(client) {
        var args = [].slice.call(arguments, 1),
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
            this._processJob();
        }
    },
    _processJob: function(job) {
        if (job) {
            var freeClient = this.getFreeClient(),
                // job level timeout setting first, then global timeout setting
                timeout = job.timeout || this.gearmanConfig.timeout || 10000,
                options,
                callback;

            if (freeClient) {
                this.busyClients.push(freeClient);

                // add job callback reference
                freeClient.callback = job.callback;
                freeClient.submitJob.apply(freeClient, job.args, {
                    background: job.background
                });

                callback = function() {
                    freeClient.callback({
                        error: true,
                        payload: 'gearman job "' + job.args[0] + '" request timeout(maxTimeout ' + timeout + 'ms!)'
                    });
                };
                // job timeout, negative num means never timeout
                if (timeout >= 0) {
                    freeClient.timer = setTimeout(callback, timeout);
                }
            } else { // when client busy add to stacks
                this.jobStack.push(job);
                this.clientBusy = true;
            }
        } else {
            // pop out a job
            while (!this.clientBusy && job = this.jobStack.shift()) {
                this._processJob(job);
            }
        }
    },
    // submit a job (two ways):
    // 1. icFrame.submitJob('reverse', " Hello World", function(job) {
    //        console.log(job.payload.toString());
    //    });
    // 2. icFrame.submitJob('reverse', " Hello World", {
    //        callback: function(job) {
    //            console.log(job.payload.toString());
    //        },
    //        timeout: 3000
    //    });
    submitJob: function() {
        var args = [].slice.call(arguments, 0),
            options = args[args.length - 1], // if last arguments is function ,consider it as callback
            job = {
                args: args
            };

        if (typeof options == 'function') {
            args.pop();
            job.callback = options;
        } else if ((typeof options == 'object') && (options.callback || options.timeout)) {
            args.pop();

            if (options.callback) {
                job.callback = options.callback;
            } else {
                job.background = true;
            }
            // job level timeout 
            if (options.timeout) {
                job.timeout = options.timeout;
            }
        } else {
            // no callback use
            job.background = true;
        }

        this._processJob(job);
    },
    // close all client connections
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