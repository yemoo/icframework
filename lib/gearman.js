var utils = require('utilities'),
    msgpack = require('msgpack'),
    Gearman = require('node-gearman');

/**
 * 初始化一个gearman服务
 * @param config {Object} 必须有server{Array}参数，且至少有一个服务器
 * @constructor
 */

function GearmanManager(config) {
    var self = this;

    self.config = config;

    // 空闲状态的clients队列
    self.freeClientStack = [];

    // 忙碌状态的clients队列
    self.busyClientStack = [];

    // 已经创建的clients连接数
    self.totalClients = 0;

    // 等待处理的任务队列
    self.jobStack = [];

    self.init();

    /*setInterval(function () {
     console.log('[' + self.NAME + '] clients: ' + self.totalClients + ', freeClientStack: ' + self.freeClientStack.length + ', busyClientStack: ' + self.busyClientStack.length);
     }, 10000);*/
}


GearmanManager.prototype = {
    constructor: GearmanManager,
    // 初始化
    init: function() {
        var self = this,
            config = self.config,
            initClients = config.initClients;

        if (initClients > 0) {
            // 为每个server都初始化initClientNum个连接
            config.server.forEach(function(server) {
                self.createClient(server, initClients);
            });
        }
    },
    /**
     * 提交一个不可用的服务器，并自动检测该服务器的状态
     * 从可用队列中暂时移除，等待30s后重新放入队列
     *
     * @param server
     */
    serverDead: function(server) {
        var config = this.config,
            servers = config.server,
            index,
            i = 0;

        if (server.dead) return;
        // 标示为不可用
        server.dead = true;

        // 从服务器列表中暂时移除
        index = servers.indexOf(server);
        if (index > -1) {
            servers.splice(index, 1);
        }

        (function() {
            var callee = arguments.callee,
                client = new Gearman(server.ip, server.port);

            // 连接成功，放回队列
            client.on('connect', function() {
                delete server.dead;
                servers.push(server);
            });

            client.on('error', function(err) {
                if (['ECONNREFUSED', 'EHOSTUNREACH'].indexOf(err.code)) {
                    if (++i < config.retries) {
                        // 尝试retries次连接
                        setTimeout(callee, config.retry);
                    } else {
                        i = 0;
                        // 超过最大尝试次数
                        setTimeout(callee, config.reconnect);
                    }
                }
            });

        })();
    },
    /**
     * 获取一个可用的server
     * @returns {server|boolean}
     */
    getServer: function() {
        // 从队列头部取出一个
        var servers = this.config.server,
            server;

        // 放入server队列尾部
        if (servers.length) {
            server = servers.shift();
            servers.push(server);
        }

        return server;
    },
    /**
     * 创建一个(或多个)新的gearman连接，并自动加入freeclient队列，等待调用. [NOTE]: 超过最大连接数则不创建
     * @param server {Object}  服务器ip/端口
     * @param _num {Number} 创建的连接数目，默认为1
     * @returns {*}
     */
    createClient: function(server, _num) {
        var self = this,
            config = this.config,
            freeClientStack = this.freeClientStack,
            num = _num && parseInt(_num),
            client, i;

        // 创建多个连接
        if (num && num > 1) {
            for (i = 0, client = []; i < num; i++) {
                client.push(self.createClient(server));
            }
            return client;
        }

        // 超过最大允许的连接数则不创建
        if (this.totalClients < config.maxClients) {
            server = server || self.getServer();
            // 无服务器或者服务器不可用，直接退出
            if (!server || server.dead) {
                return;
            }
            client = new Gearman(server.ip, server.port);
            client.on("close", function() {
                console.log("Server " + server.ip + ':' + server.port + " disconnected!");
            });
            client.on("error", function(err) {
                console.error("Server " + server.ip + ':' + server.port + ' ' + err.message);
                // 服务器不能连接
                if (['ECONNREFUSED', 'EHOSTUNREACH'].indexOf(err.code) > -1) {
                    self.removeClient(client);
                    self.serverDead(server);
                }
            });
            client.connect();

            // 添加到空闲队列中
            freeClientStack.push(client);
            this.totalClients++;
        }

        return client;
    },
    /**
     * 移除一个client（如移除无效的client）
     * @param client
     */
    removeClient: function(client) {
        var index = this.busyClientStack.indexOf(client);

        if (index > -1) {
            this.busyClientStack.splice(index, 1);
            this.totalClients--;
        } else {
            index = this.freeClientStack.indexOf(client);
            if (index > -1) {
                this.freeClientStack.splice(index, 1);
                this.totalClients--;
            }
        }
    },
    /**
     * 获取一个空闲的gearman连接，如果没有空闲的连接则返回false
     * @returns {client|Boolean}
     */
    getFreeClient: function() {
        var client;
        if (!this.freeClientStack.length) {
            this.createClient();
        }
        client = this.freeClientStack.shift();
        if (client) {
            this.busyClientStack.push(client);
        }
        return client;
    },
    /**
     * 释放一个忙碌的client
     * @param client {client}
     */
    setClientFree: function(client) {
        var index = this.busyClientStack.indexOf(client);
        // 从忙碌队列中移除
        if (index > -1) {
            this.busyClientStack.splice(index, 1);
        }

        // 放入到空闲队列
        this.freeClientStack.push(client);

        // 如果队列中有未处理的job，则处理之
        if (this.jobStack.length) {
            this.processJob.apply(this, this.jobStack.shift());
        }
    },
    /**
     * 提交的一个任务(job)
     * @param name {String} job名称
     * @param params {*} 传递给job的数据 {request: {}, header:{}}
     * @param options {Object|Function}  job可选参数+timeout/callback设置 / 回调函数
     * @returns {boolean}
     */
    submitJob: function(name, params, options) {
        var config = this.config,
            header,
            callback;

        if (arguments.length < 1) {
            return false;
        }

        // job前缀/后缀
        if (config.prefix) {
            name = config.prefix + name;
        }
        if (config.suffix) {
            name += config.suffix;
        }

        // 无回调函数默认为后台执行的job
        if (!options) {
            options = {
                background: true
            };
        } else if (typeof options === 'function') {
            // 有回调函数则默认前台执行
            callback = options;
            options = {
                background: false
            };
        } else if (typeof options === 'object') {
            if (!options.background && options.callback) {
                callback = options.callback;
            }
        }

        // params格式为：{request:{}, header:{}}
        if (params) {
            if (!params.hasOwnProperty('request') && !params.hasOwnProperty('header')) {
                params = {
                    request: params,
                    header: {}
                }
            } else {
                !params.hasOwnProperty('request') && (params.request = {});
                !params.hasOwnProperty('header') && (params.header = {});
            }
        }
        // callback返回数据格式为：{response:{}, header:{}}
        if (callback) {
            callback = (function(cb) {
                return function(data) {
                    if (!data.hasOwnProperty('response') && !data.hasOwnProperty('header')) {
                        data = {
                            response: data,
                            header: params.header || {}
                        };
                    } else {
                        !data.hasOwnProperty('response') && (data.response = {});
                        !data.hasOwnProperty('header') && (data.header = params.header || {});
                    }
                    cb.call(this, data);
                };
            })(callback);
        }

        return this.processJob(name, params, options, options.timeout, callback);
    },
    /**
     * 进入Job处理队列
     * @param name {string} job名称
     * @param params {*} 传递给job的数据
     * @param options {Object} job配置项
     * @param timeout {Number} 超时时间，默认用全局配置
     * @param callback {Function} 处理job数据的回调函数
     */
    processJob: function(name, params, options, timeout, callback) {
        var self = this,
            args = arguments,
            config = this.config,
            client = this.getFreeClient(),
            job;

        // 无可用的server，直接返回错误
        if (!config.server.length) {
            callback && callback({
                err_no: -10,
                err_msg: 'No gearman server available',
                results: ''
            });
            return;
        }

        // 有空闲的client
        if (client) {
            job = client.submitJob(name, msgpack.pack(params), options);

            // non-background
            if (callback) {
                // Job超时捕获
                job.setTimeout(timeout || config.timeout, function(err) {
                    callback({
                        err_no: -11,
                        err_msg: err.message,
                        results: ''
                    });
                });
                // job调用失败
                job.on('error', function(err) {
                    callback({
                        err_no: -12,
                        err_msg: err.message,
                        results: ''
                    });
                });
                job.on('data', function(data) {
                    callback(msgpack.unpack(data));
                    // 标示该client为空闲状态
                    self.setClientFree(client);
                })
            } else {
                // background-job，标示该client为空闲状态
                self.setClientFree(client);
            }
        } else {
            // 无空闲的client时，放到队列中
            self.jobStack.push(arguments);
        }
    },
    /**
     * 关闭建立的所有clients
     */
    closeClients: function() {
        var client;
        while (client = this.freeClientStack.pop()) {
            client.close();
        }
        while (client = this.busyClientStack.pop()) {
            client.close();
        }
    }
};

/**
 * 对一组gearman配置的管理
 * @param config {Object}  {group:[], config:{}}
 * @constructor
 */

function GearmanGroupManager(config) {
    var self = this;

    if (!config) {
        console.warn('No Gearman Config Found!');
        return;
    }

    // 默认的Gearman服務，默认采用gmserver中的第一个
    self.defaultGearman = null;

    // server表
    self.gearmanGroups = {};

    //server与jobname的分隔符
    self.separator = config.seperator || '::';

    self.init(config);
}

GearmanGroupManager.prototype = {
    constructor: GearmanGroupManager,
    init: function(config) {
        var self = this,
            defConfig = config.config || {},
            group = config.group;

        if (!(group instanceof Array)) {
            if (group && typeof group == 'object') {
                group = [group];
            } else {
                console.warn('Invalid Group Config, Must be Object or Array!', group);
                return;
            }
        }

        group.forEach(function(config, index) {
            if (config.server && typeof config.server == 'object') {
                if (!config.name) {
                    config.name = 'group_' + index;
                }
                self.initGearman(utils.mixin({}, defConfig, config, true));
            } else {
                console.warn('Invalid Config, "Server" Key Not Found!', config);
            }
        });
    },
    initGearman: function(config) {
        var name = config.name,
            gearman;

        if (!(config.server instanceof Array)) {
            config.server = [config.server];
        }

        gearman = new GearmanManager(config);
        gearman.NAME = name;
        this.gearmanGroups[config.name] = gearman;

        // 初始化/设置默认gearman服务
        if (!this.defaultGearman || config.isDefault) {
            this.defaultGearman = gearman;
        }
    },
    submitJob: function(name) {
        var separator = this.separator,
            gearmanGroups = this.gearmanGroups,
            gearman = this.defaultGearman,
            serverName = gearman && gearman.NAME;

        // 获取job所在的服务分组(serverName)
        if (~name.indexOf(separator)) {
            name = name.split(separator);
            serverName = name[0];
            name = name[1];
            gearman = gearmanGroups[serverName];
        }

        if (gearman) {
            gearman.submitJob.apply(gearman, arguments);
        } else {
            console.warn('Gearman Server [' + serverName + '] Not Found!');
        }
    },
    closeClients: function() {
        var gearmanGroups = this.gearmanGroups;
        Object.keys(gearmanGroups).forEach(function(name) {
            gearmanGroups[name].closeClients();
        });
    }
};

module.exports = function(configs) {
    return new GearmanGroupManager(configs);
};