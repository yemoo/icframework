var fs = require('fs'),
    msgpack = require('msgpack'),
    Gearman = require('./node-gearman').Gearman;

// assume all server support all jobs
GearmanManager = {
    init: function() {
        this.gearmanConfig = icFrame.config.gearman;
        this.enableGearman = this.gearmanConfig && this.gearmanConfig.server && this.gearmanConfig.server.length > 0;

        this.jobStack = [];
        this.curServerNum = 0;

        this.clientNum = 0;
        this.clients = [];
        this.busyClients = [];

        this.enableGearman && this._initGearmanClient();
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

        if (this.enableGearman && this.clientNum < maxClientNum) {
            server = this.getServer();

            if (server) {
                client = new Gearman(server.ip, server.port);
                client.on('WORK_COMPLETE', function(job) {
                    // unpack data
                    job.payload = msgpack.unpack(job.payload);
                    // run callback
                    self._workComplete(client, job);
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
    _workComplete: function(client, job) {
        client.callback.call(client, job);

        // remove from busyClient stack
        this.busyClients.splice(this.busyClients.indexOf(client), 1);

        // delete client reference
        delete client.callback;
        clearTimeout(client.timer);
        delete client.timer;

        // add the client to freeClient stack
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
                timeout = job.timeout || this.gearmanConfig.timeout || 10000;

            if (freeClient) {
                this.busyClients.push(freeClient);

                // add job callback reference
                freeClient.callback = job.callback;
                //console.log(job.args[1]);
                // package data to binary format
                if (job.args[1] !== null) {
                    job.args[1] = msgpack.pack(job.args[1]);
                }

                freeClient.submitJob.apply(freeClient, job.args);
                // job timeout, negative num means never timeout
                //console.log(job.args[2], job.args[0], timeout);
                if (job.callback && (job.args[2] == null || !job.args[2].background) && timeout >= 0) {
                    freeClient.timer = setTimeout(function() {
                        freeClient.callback({
                            error: true,
                            payload: 'gearman job "' + job.args[0] + '" request timeout(maxTimeout ' + timeout + 'ms!)'
                        });
                    }, timeout);
                }
            } else { // when client busy add to stacks
                this.jobStack.push(job);
                this.clientBusy = true;
            }
        } else {
            // pop out a job
            while (!this.clientBusy && (job = this.jobStack.shift())) {
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
    submitJob: function(fname, data, options) {
        var job = {};

        if (arguments.length < 1) {
            return false;
        } else if (arguments.length < 3) {
            // no callback use
            options = {
                background: true
            };
        } else {
            if (typeof options == 'function') {
                job.callback = options;
                options = null;
            } else if (typeof options == 'object') {
                if (options.callback) {
                    job.callback = options.callback;
                    delete options.callback;
                } else {
                    // no callback use
                    options.background = true;
                }
                // job level timeout 
                if (options.timeout) {
                    job.timeout = options.timeout;
                    delete options.timeout;
                }
            }
        }
        job.args = [fname, data || null, options];
        //console.log(job.args);
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