var utils = icFrame.utils,
    logger = icFrame.logger.getLogger('gearman'),
    msgpack = require('msgpack'),
    Gearman = require('node-gearman'),
    ERRCODE = ['ECONNREFUSED', 'EHOSTUNREACH', 'ECONNRESET', 'ETIMEDOUT'];

/**
 * 初始化一个gearman服务
 * @param config {Object} 必须有server{Array}参数，且至少有一个服务器
 * @constructor
 */

function GearmanManager(config) {
    var self = this;

    self.config = config;

    self.running = true; // 标志为运行状态

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
            initClients = parseInt(config.initClients) || 0;

        // 初始化initClient个连接
        if (initClients) {
            initClients -= self.totalClients;
            for (var i = 0; i < initClients; i++) {
                self.createClient();
            }
        }
    },
    /**
     * 提交一个不可用的服务器，并自动检测该服务器的状态
     * 从可用队列中暂时移除，等待30s后重新放入队列
     *
     * @param server
     */
    serverDead: function(server) {
        var self = this,
            config = self.config,
            servers = config.server,
            index,
            i = 1;

        if (server.dead) {
            return;
        }
        // 标示为不可用
        server.dead = true;

        // 从服务器列表中暂时移除
        index = servers.indexOf(server);
        if (index > -1) {
            servers.splice(index, 1);
        }
        (function() {
            var callee = arguments.callee,
                serverName = config.name + '[' + server.ip + ':' + server.port + ']',
                client = new Gearman(server.ip, server.port);

            // 连接成功，放回队列
            client.on('connect', function() {
                delete server.dead;
                servers.push(server);
                // 连接建立成功则关闭该client连接
                client.close();
                // 重连成功则初始化连接
                logger.info("Server " + serverName + " reconnected successful!");
                self.init();
            });

            client.on('error', function(err) {
                if (ERRCODE.indexOf(err.code) > -1) {
                    // 关闭该连接
                    client.close();
                    if (i++ < config.retries) {
                        setTimeout(callee, config.retry);
                    } else {
                        i = 1;
                        // 超过最大尝试次数
                        logger.info("fail " + config.retries + " times, retry connnect server " + serverName + ' after ' + config.reconnect + 'ms');
                        setTimeout(callee, config.reconnect);
                    }
                }
            });
            client.connect();
            // 尝试retries次连接
            logger.info("retry(" + i + ") connect server " + serverName);
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
     * @returns {*}
     */
    createClient: function() {
        var self = this,
            config = self.config,
            server, serverName, client;

        // 超过最大允许的连接数则不创建
        if (self.totalClients < config.maxClients) {
            server = self.getServer();
            // 无服务器或者服务器不可用，直接退出
            if (!server) {
                return false;
            }
            serverName = config.name + '[' + server.ip + ':' + server.port + ']',
            client = new Gearman(server.ip, server.port);
            // 连接成功
            client.on('connect', function() {
                // 添加到空闲队列中
                self.freeClientStack.push(client);
                self.totalClients++;
                logger.info('Successful initalize a client connection on ' + serverName + ' (total: ' + self.totalClients + ')');
                self.processStackJob();
            });
            // gearman服务关闭
            client.on("close", function() {
                self.removeClient(client);
                logger.info('Disconnected a client on  ' + serverName + ' (total: ' + self.totalClients + ')');
            });
            // 初始化连接时出错
            client.on("error", function(err) {
                logger.error("Server " + serverName + ' ' + err.message);
                self.removeClient(client);
                // 服务器不能连接
                if (ERRCODE.indexOf(err.code) > -1) {
                    // 标记该client对应的服务器不可用
                    self.serverDead(server);
                }
            });
            client.connect();
        }

        return client;
    },
    /**
     * 移除一个client（如移除无效的client）
     * @param client
     */
    removeClient: function(client) {
        var index = this.busyClientStack.indexOf(client);

        // 先尝试关闭该连接以释放其资源
        try {
            client.close();
        } catch (e) {
            logger.warn('Cause an error when close a client: ' + e.stack);
        }
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

        // 确保总数不会小于0
        this.totalClients = Math.max(0, this.totalClients);

        // 运行时连接数等于0，尝试创建连接
        if (!this.totalClients && this.running) {
            this.createClient();
        }
    },
    /**
     * 获取一个空闲的gearman连接，如果没有空闲的连接则返回false
     * @returns {client|Boolean}
     */
    getFreeClient: function() {
        var client = false;
        if (!this.freeClientStack.length) {
            this.createClient();
        } else {
            client = this.freeClientStack.shift();
            if (client) {
                this.busyClientStack.push(client);
            }
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
        if (this.freeClientStack.indexOf(client) == -1) {
            this.freeClientStack.push(client);
        }

        this.processStackJob();
    },
    // 尝试处理队列中的任务
    processStackJob: function() {
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
        name = (config.prefix || '') + name + (config.suffix || '');

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
                delete options.callback;
            }
        }

        return this.processJob(name, params, options, callback);
    },
    /**
     * 进入Job处理队列
     * @param name {string} job名称
     * @param params {*} 传递给job的数据
     * @param options {Object} job配置项
     * @param callback {Function} 处理job数据的回调函数
     */
    processJob: function(name, params, options, callback) {
        var self = this,
            args = arguments,
            config = self.config,
            timeout = options.timeout || config.timeout,
            client = this.getFreeClient(),
            job;

        // 有空闲的client
        if (client) {
            job = client.submitJob(name, msgpack.pack(params), utils.string.uuid(), options);

            // non-background
            if (callback) {
                // Job超时捕获
                if (timeout) {
                    job.setTimeout(timeout, function(err) {
                        callback({
                            err_no: -11,
                            err_msg: err.message,
                            results: ''
                        });
                        self.setClientFree(client);
                    });
                }

                // job调用失败
                job.on('error', function(err) {
                    callback({
                        err_no: -12,
                        err_msg: err.message,
                        results: ''
                    });
                    self.setClientFree(client);
                });
                job.on('data', function(data) {
                    callback(msgpack.unpack(data));
                    // 标示该client为空闲状态
                    self.setClientFree(client);
                });
            } else {
                // background-job，标示该client为空闲状态
                self.setClientFree(client);
            }
        } else {
            // 无可用的server，直接返回错误
            if (!config.server.length) {
                callback && callback({
                    err_no: -10,
                    err_msg: 'No gearman server available',
                    results: ''
                });
            } else {
                // 无空闲的client时，放到队列中
                self.jobStack.push(arguments);
            }
        }
    },
    /**
     * 关闭建立的所有clients
     */
    closeClients: function() {
        this.running = false;
        this.freeClientStack.forEach(function(client) {
            client.close();
        });
        this.busyClientStack.forEach(function(client) {
            client.close();
        });
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
        logger.warn('No Gearman Config Found!');
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

        // group config必须是数组
        if (!Array.isArray(group)) {
            logger.warn('Invalid Group Config, Must be an Array!', group);
            return;
        }

        group.forEach(function(config, index) {
            if (config.server && typeof config.server == 'object') {
                if (!config.name) {
                    config.name = 'group_' + index;
                }
                // 按分组初始化
                self.initGearman(utils.mixin({}, defConfig, config, true));
            } else {
                logger.warn('Invalid Config, "Server" Key Not Found!', config);
            }
        });
    },
    initGearman: function(config) {
        var name = config.name,
            gearman;

        if (!Array.isArray(config.server)) {
            config.server = [config.server];
        }

        gearman = new GearmanManager(config);
        gearman.NAME = name;
        this.gearmanGroups[name] = gearman;

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
        if (name.indexOf(separator) > -1) {
            name = name.split(separator);
            serverName = name[0];
            name = name[1];
            gearman = gearmanGroups[serverName];
        }

        if (gearman) {
            gearman.submitJob.apply(gearman, arguments);
        } else {
            logger.warn('Gearman Server [' + serverName + '] Not Found!');
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
    logger.info('======================= GearmanManager INIT ========================');
    return new GearmanGroupManager(configs);
};