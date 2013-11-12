/* global icFrame */
var fs = require('fs'),
    path = require('path'),
    express = require('express'),
    app = express(),
    expressValidator = require('express-validator'),
    utils = require('./frameutil'),
    security = require('./security'),
    filterUtil = require('./filter'),
    ctrlUtilFn = require('./ctrlutil'),
    routerConfig = require('./router'),
    errorHandler = require('./errorhandler'),
    log4js = icFrame.logger,
    logger = log4js.getLogger(),
    config = icFrame.config,
    plugins;

function normalize(p) {
    return path.normalize(p).replace(/(^\/|\/$)/g, '');
}

// 文件cache：plugin/filter/controller文件/url->action方法/模版文件, config不能禁止缓存

var DEFAULT_CTRL = 'index',
    DEFAULT_ACTION = 'index',
    APP = {
        /**
         * Initialize the server
         */
        init: function() {
            this.app = app;
            // controller cache
            this.controllerRegistry = {};
            // url config cache
            this.urlConfig = {};
            // view cache
            this.viewRegistry = {};

            // config app
            this.configApp();
            // config request route
            this.configRouter();
        },
        configApp: function() {
            var viewCfg = config.view,
                engines = viewCfg.engines,
                exts = Object.keys(engines),
                accessLogCfg;

            app.set('env', config.env);
            // init all view engines
            exts.forEach(function(ext) {
                app.engine(ext, engines[ext]);
            });
            // set the default extension 
            app.set('view engine', exts[0]);
            app.set('view cache', viewCfg.cache);
            // default view path
            app.set('views', viewCfg.path);
            // default view data
            if (viewCfg.data && typeof viewCfg.data === 'object') {
                app.locals(viewCfg.data);
            }

            // disabled x-powered-by
            app.disable('x-powered-by');
            if (typeof config.express === 'object') {
                Object.keys(config.express).forEach(function(key) {
                    app.set(key, config.express[key]);
                });
            }

            // config default favicon. for example: express.favicon('xxx/xxx.ico');
            // ref: http://www.senchalabs.org/connect/middleware-favicon.html
            app.use(express.favicon(config.favicon));

            // [SECURITY]：过滤父路径访问
            app.use(function(req, res, next) {
                if (req.url.indexOf('../') > -1) {
                    req.url = req.url.replace(/\.\.\//g, '');
                    // 删除以便重新初始化req.query
                    delete req.query;
                }
                next();
            });
            app.use(express.query());
            // END [SECURITY]

            // parse post data (request body)
            app.use(express.bodyParser());

            // Compress response data with gzip / deflate
            config.gzip && app.use(express.compress());

            // ref: http://expressjs.com/api.html#cookieParser
            app.use(express.cookieParser(config.cookie && config.cookie.secret));

            // validator utils
            app.use(expressValidator);

            // convert _method field value to http method 
            // [client] <input type="hidden" name="_method" value="put" />
            // [server]
            // app.put('/users/:id', function (req, res, next) {
            //       // edit your user here
            // });
            // ref: http://www.senchalabs.org/connect/methodOverride.html
            app.use(express.methodOverride());

            // access log
            try {
                accessLogCfg = config.log.config.appenders.access.config;
            } catch (e) {}
            app.use(log4js.connectLogger(log4js.getLogger('access'), accessLogCfg));

            // security: xss, csrf, sqli...
            app.use(security);

            // Session config
            if (config.session) {
                if (config.session.cookie && config.session.cookie.expires) {
                    config.session.cookie.expires = new Date(config.session.cookie.expires);
                }
                if (typeof config.session.store === 'function') {
                    config.session.store = config.session.store(express);
                }
            }
            app.use(express.session(config.session));

            // plugins
            if (config.cache) {
                plugins = icFrame.configUtil.loadConfig({}, 'plugin');
                Object.keys(plugins).forEach(function(pname) {
                    var plugin = plugins[pname];
                    if (typeof plugin == 'function') {
                        plugin.NAME = pname;
                        app.use(function(req, res, next) {
                            plugin.apply(this, arguments);
                        });
                    }
                });
            } else {
                app.use(function(req, res, next) {
                    var self = this,
                        queues = [],
                        _next = function(err) {
                            if (err) {
                                return next(err);
                            }
                            runQueue();
                        },
                        runQueue = function() {
                            var queue = queues.shift();
                            queue ? queue.apply(self, [req, res, _next]) : next();
                        };

                    plugins = icFrame.configUtil.loadConfig({}, 'plugin', true);
                    Object.keys(plugins).forEach(function(pname) {
                        var plugin = plugins[pname];
                        if (typeof plugin == 'function') {
                            plugin.NAME = pname;
                            queues.push(plugin);
                        }
                    });
                    runQueue();
                });
            }

            // 程序异常退出/服务器处理超时
            process.nextTick(function() {
                // 放到最后处理，需要等用户处理函数执行完成
                app.use(function(req, res, next) {
                    setTimeout(function() {
                        var error = new Error('Request timeout!');
                        error.code = 408;
                        if (!res.headerSent) {
                            next(error);
                        }
                    }, req.timeout || config.timeout);
                    next();
                });
            });

            app.use(app.router);
            app.use(errorHandler.notFound(config.notFoundPage));
            app.use(errorHandler.error(config.errorPage));
        },
        // get controller instance, cache controller
        _getInstance: function(fileName) {
            var controllerRegistry = this.controllerRegistry,
                filePath,
                Controller,
                instance = controllerRegistry[fileName];

            if (!config.cache || !(fileName in controllerRegistry)) {
                // all controller path and file name must lowercase, named use underscore
                filePath = path.join(config.ctrlpath, fileName.toLowerCase() + '.js');
                if (fs.existsSync(filePath)) {
                    Controller = config.cache ? require(filePath) : utils.frame.forcerequire(filePath);
                    instance = new Controller();
                }
                controllerRegistry[fileName] = instance;
            }
            return instance;
        },
        _getUrlConfig: function(originalUrl) {
            var self = this,
                urlConfig = self.urlConfig,
                url = normalize(originalUrl),
                curConfig = urlConfig[url],
                success, instance, filepath, action;

            if (!config.cache || !curConfig || !curConfig.parsed) {
                //if (!curConfig) {
                curConfig = urlConfig[url] = {};
                //}
                curConfig.url = url;
                curConfig.mappedUrl = normalize(curConfig.mappedUrl || originalUrl);

                // 使用mappedUrl来解析
                filepath = curConfig.mappedUrl ? curConfig.mappedUrl.split('/') : [];

                // 规则1：默认认为最后一级路径为action，倒数第二级为controller(即文件名)
                action = filepath.pop() || DEFAULT_ACTION;
                instance = self._getInstance(filepath.join('/') || DEFAULT_CTRL);
                success = instance && instance[action];

                if (filepath.length) {
                    // 规则2：如果规则1解析失败，则尝试认为filePath为目录，默认controller为index，action不变
                    if (!success) {
                        instance = self._getInstance(filepath.concat([DEFAULT_CTRL]).join('/'));
                        success = instance && instance[action];
                        success && filepath.push(DEFAULT_CTRL);
                    }

                    // 规则3：如果规则1,2解析失败，默认action为index，最后一级路径为controller
                    if (!success) {
                        action && filepath.push(action);
                        action = DEFAULT_ACTION;
                        instance = self._getInstance(filepath.join('/') || DEFAULT_CTRL);
                        success = instance && instance[action];
                    }
                }

                if (success) {
                    utils.mixin(curConfig, {
                        instance: instance,
                        filepath: filepath.join('/') || DEFAULT_CTRL,
                        controller: filepath.pop() || DEFAULT_CTRL,
                        action: action
                    });

                    if (curConfig.view) {
                        curConfig.view = normalize(curConfig.view);
                    }

                    curConfig.view = self._getViewPath(curConfig);
                    curConfig.callback = self._getCallback(curConfig);
                } else {
                    curConfig.notfound = true;
                    curConfig.callback = function(req, res, next) {
                        return next();
                    };
                }

                curConfig.parsed = true;
            }
            return curConfig;
        },
        _getViewPath: function(urlConfig) {
            var viewpath = urlConfig.view || urlConfig.mappedUrl,
                view = config.view,
                originpath, filepath;

            if (!(viewpath in this.viewRegistry)) {
                originpath = path.join(view.path, viewpath);

                if (path.extname(originpath)) {
                    filepath = fs.existsSync(originpath) ? originpath : false;
                } else {
                    // auto add ext
                    Object.keys(view.engines).some(function(ext) {
                        ext = ('.' !== ext[0] ? '.' : '') + ext;
                        filepath = originpath + ext;

                        if (!fs.existsSync(filepath)) {
                            filepath = path.join(originpath, 'index' + ext);

                            if (!fs.existsSync(filepath)) {
                                filepath = false;
                            }
                        }
                        return filepath;
                    });
                }
                this.viewRegistry[viewpath] = filepath;
            }
            return this.viewRegistry[viewpath];
        },

        // wrap the router callback use user-custom callback
        _getCallback: function(urlConfig) {
            var instance = urlConfig.instance,
                filepath = urlConfig.filepath,
                controller = urlConfig.controller,
                action = urlConfig.action,
                view = urlConfig.view,
                wrapReqCallback = utils.frame.wrapReqCallback,
                filter = filterUtil.init(!config.cache).getActionFilter(instance, action),
                before = filter.before,
                after = filter.after;

            return function(req, res) {
                var args = arguments,
                    ctrlUtil = new ctrlUtilFn(),
                    callback = instance[action],
                    resEnd = res.end,
                    resWrite = res.write,
                    onEnd = function(req, res, next) {
                        next && next();
                        process.emit('REQUEST_END');
                        onEnd = function() {};
                    };

                // rewrite next() callback to empty, one action one callback
                args[2] = function() {};

                process.emit('REQUEST_START');

                res.once('close', function() {
                    ctrlUtil.set('valid', false);
                });

                // avoid repeat res.end call
                res.isEnded = false;
                // auto write header for chunked output
                res.write = function() {
                    res.write = resWrite;
                    !res.headersSent && !res.get('Content-Type') && ctrlUtil._writeHead();
                    resWrite.apply(res, arguments);
                };
                res.end = function() {
                    if (!res.isEnded) {
                        resEnd.apply(res, arguments);
                        res.isEnded = true;
                    }
                    ctrlUtil.get('syncStack').length = 0;
                    onEnd();
                };

                utils.mixin(ctrlUtil, {
                    __valid__: true,
                    __req__: req,
                    __res__: res,
                    __instance__: instance,
                    // bind view to the instance
                    __view__: view,
                    // current controller and action Name
                    __filepath__: filepath,
                    __controller__: controller,
                    __action__: action,

                    __syncStack__: []
                });

                req.ctrlUtil = ctrlUtil;
                // default header setting
                res.charset = (config.charset || 'utf-8');
                res.mimeType = 'html';

                // ============= Before Filter ===============
                if (before) {
                    Object.keys(before).forEach(function(key) {
                        var cb = before[key];
                        cb.NAME = key;
                        ctrlUtil.run(wrapReqCallback(cb));
                    });
                }
                // ========== End Before Filter ==============

                // run user callback
                callback = (function(cb) {
                    return function(req, res, next) {
                        if (typeof cb === 'function') {
                            wrapReqCallback(cb).apply(instance, args);
                        } else if (cb === 'SHOW_VIEW') {
                            ctrlUtil.render();
                        } else {
                            res.send(cb);
                        }

                        // ============= After Filter ===============
                        // usually Used to write log...
                        if (after) {
                            Object.keys(after).forEach(function(key) {
                                var cb = after[key];
                                cb.NAME = key;
                                ctrlUtil.run(wrapReqCallback(cb));
                            });
                        }
                        // ========== After Before Filter ===========

                        onEnd.NAME = 'ONEND';
                        ctrlUtil.run(onEnd);

                        next();
                    };
                })(callback);

                callback.NAME = 'USER_CALLBACK';
                ctrlUtil.run(callback);

                // process queue: run chunkedQueue or end the response
                ctrlUtil.runQueue();
            };
        },
        // entry
        configRouter: function() {
            var self = this;

            // merge routerConfig to urlDataInfo During initialization
            utils.mixin(self.urlConfig, routerConfig);

            // custom router. item format: {url: {url:'', method:'', mappedUrl:'', view:''}}
            Object.keys(routerConfig).forEach(function(url) {
                var urlConfig = self.urlConfig[url],
                    callback;

                if (urlConfig.mappedUrl && ~urlConfig.mappedUrl.indexOf(':')) {
                    callback = function(req) {
                        var url = req.path;

                        if (!self.urlConfig[url]) {
                            self.urlConfig[url] = utils.mixin({}, urlConfig, {
                                mappedUrl: urlConfig.mappedUrl.replace(/:([^\/]+)/g, function(o, name) {
                                    return req.params[name];
                                })
                            });
                            self._getUrlConfig(url);
                        }
                        return self.urlConfig[url].callback.apply(this, arguments);
                    };
                } else {
                    callback = self._getUrlConfig(url).callback;
                }
                app[urlConfig.method || 'all'](url, callback);
            });

            // default router
            app.all('*', function(req) {
                var url = req.path;
                // 强制重置路径中的下划线为中划线
                if (~url.indexOf('_')) {
                    url = url.replace(/_/g, '-');
                    logger.warn('[inValid URL]:' + req.originalUrl);
                }
                self._getUrlConfig(url).callback.apply(this, arguments);
            });
        }
    };
APP.init();
module.exports = APP;