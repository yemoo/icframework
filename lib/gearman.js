var utils = icFrame.utils,
    fs = require('fs'),
    logger = icFrame.logger.getLogger('gearman'),
    msgpack = require('msgpack'),
    Gearman = require('node-gearman');

function submitJob(name, params, options) {
    var timeout = (options && options.timeout) || this.config.timeout,
        gearman = this.gearman,
        client, callback, job;

    if (arguments.length < 1) {
        return false;
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
            delete options.callback;
        }
    }

    // 没有找到对应的服务器配置
    if (!gearman) {
        callback({
            err_no: -12,
            err_msg: 'no gearman server is available!',
            results: ''
        });
        return false;
    }

    client = new Gearman(gearman.host, gearman.port);
    job = client.submitJob(name, msgpack.pack(params), utils.string.uuid(), options);

    // non-background
    if (callback) {
        // Job超时捕获
        if (timeout) {
            job.setTimeout(timeout, function(err) {
                client.close();
                callback({
                    err_no: -11,
                    err_msg: err.message,
                    results: ''
                });
            });
        }
        // 初始化连接时出错
        client.on("error", function(err) {
            callback({
                err_no: -12,
                err_msg: err.message,
                results: ''
            });
        });
        // job调用失败
        job.on('error', function(err) {
            client.close();
            callback({
                err_no: -12,
                err_msg: err.message,
                results: ''
            });
        });
        // 数据返回
        job.on('data', function(data) {
            client.close();
            callback(msgpack.unpack(data));
        });
    }
}

function GearmanManager(config) {
    var self = this;

    if (!config) {
        logger.warn('No Gearman Config Found!');
        return;
    }

    self.config = config;

    //server与jobname的分隔符
    self.separator = config.seperator || '::';

    // 最后一次配置修改时间
    self.configLastModified = null;
    self.workers = null;

    self.init();
}

GearmanManager.prototype = {
    constructor: GearmanManager,
    init: function() {
        var self = this,
            workers = self.config.workers;

        // 文件配置，自动加载
        if (typeof workers == 'string') {
            self.loadGroupInfo();
            // 每一秒检测一次变化
            setInterval(function() {
                self.loadGroupInfo();
            }, 1000);
        }
    },
    loadGroupInfo: function(callback) {
        var self = this,
            mtime, isChanged;

        fs.stat(self.config.workers, function(err, stat) {
            if (err) {
                return logger.warn(err);
            }

            mtime = +new Date(stat.mtime);
            isChanged = mtime !== self.configLastModified;

            // 文件更新则重新加载一次
            if (!self.workers || isChanged) {
                self.configLastModified = mtime;
                self.workers = JSON.parse(fs.readFileSync(self.config.workers).toString());
                Object.keys(self.workers).forEach(function(name) {
                    var host = self.workers[name].host[0].split(':');
                    self.workers[name] = {
                        host: host[0],
                        port: host[1] || 4730
                    };
                });
            }

            // 执行回调
            if (typeof callback === 'function') {
                callback(isChanged);
            }
        });
    },
    submitJob: function(name) {
        var separator = this.separator,
            gearman, client;

        // 获取job所在的服务分组(serverName)
        if (name.indexOf(separator) > -1) {
            name = name.split(separator);
            serverName = name[0];
            name = name[1];
        }

        submitJob.apply({
            gearman: this.workers[name],
            config: this.config.config
        }, arguments);
    },
    closeClients: function() {}
};

module.exports = function(configs) {
    //logger.info('======================= GearmanManager INIT ========================');
    return new GearmanManager(configs);
};