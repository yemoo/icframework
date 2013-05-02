var fs = require('fs'),
    msgpack = require('msgpack'),
    logger = require('./logger'),
    Gearman = require('gearman').Gearman;

// assume all server support all jobs
GearmanManager = {
    init: function(config) {
        this.gearmanConfig = config;
        this.enableGearman = this.gearmanConfig && this.gearmanConfig.server && this.gearmanConfig.server.length > 0;

        this.jobStack = [];
        this.curServerNum = 0;

        this.clientNum = 0;
        this.clients = [];
        this.busyClients = [];

        this.enableGearman && this._initGearmanClient();

        return this;
    },
    _initGearmanClient: function() {
        var clientNum = this.gearmanConfig.clientNum,
            i = 0,
            newClient;

        for (; i < clientNum; i++) {
            newClient = this.createClient();
            newClient && this.clients.push(newClient);
        }
    },
    getServer: function() {
        var servers = this.gearmanConfig.server,
            num = servers.length;

        return servers[this.curServerNum++ % num] || {};
    },
    createClient: function() {
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
    getClient: function() {
        var client = this.clients.length ? this.clients.shift() : this.createClient();
        client && this.busyClients.push(client);
        return client;
    },
    setClientFree: function(client) {
        var index = this.busyClients.indexOf(client);
        // remove from busyClient stack
        ~index && this.busyClients.splice(index, 1);

        // delete client reference
        delete client.callback;
        clearTimeout(client.timer);
        delete client.timer;

        // add the client to freeClient stack
        this.clients.push(client);
    },
    _workComplete: function(client, job) {
        client.callback && client.callback.call(client, job);

        this.setClientFree(client);

        // if client is free, start process jobs
        if (this.clientBusy) {
            this.clientBusy = false;
            this._processJob();
        }
    },
    _processJob: function(job) {

        if (job) {
            var client = this.getClient(),
                // job level timeout setting first, then global timeout setting
                timeout = job.timeout || this.gearmanConfig.timeout || 10000,
                background = job.args[2].background;

            if (client) {
                // add job callback reference
                client.callback = job.callback;

                // package data to binary format
                if (job.args[1] !== null) {
                    job.args[1] = msgpack.pack(job.args[1]);
                }

                client.submitJob.apply(client, job.args);

                // background run: no callback, always considered as freeclient
                if (background) {
                    this.setClientFree(client);
                } else {
                    client.timer = setTimeout(function() {
                        client.callback({
                            error: true,
                            payload: 'gearman job "' + job.args[0] + '" request timeout(maxTimeout ' + timeout + 'ms!)'
                        });
                        client.callback = function(){};
                        // waiting autoComplete Event and free the client
                        // this.setClientFree(client);
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
        var config = this.gearmanConfig,
            job = {},
            callback;

        if (arguments.length < 1) {
            return false;
        } else if (arguments.length < 3) {
            // no callback use
            options = {
                background: true
            };
        } else {
            if (typeof options == 'function') {
                callback = options;
                options = {
                    background: false
                };
            } else if (typeof options == 'object') {
                if (!options.background && options.callback) {
                    callback = options.callback;
                }
                delete options.callback;

                // job level timeout 
                if (options.timeout) {
                    job.timeout = options.timeout;
                    delete options.timeout;
                }
            }
        }

        if (callback) {
            job.callback = function() {
                try {
                    return callback.apply(this, arguments);
                } catch (e) {
                    logger.error('gearman callback error: ' + e.stack);
                }
            };
        }

        if (config.prefix) {
            fname = config.prefix + fname;
        }
        if (config.suffix) {
            fname += config.suffix;
        }
        job.args = [fname, data || {}, options];

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

module.exports = GearmanManager;