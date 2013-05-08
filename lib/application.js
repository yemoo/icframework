var express = require('express'),
    app = express(),
    expressValidator = require('express-validator'),
    utils = require('utilities'),
    sysUtil = require('util'),
    fs = require('fs'),
    path = require('path'),
    printf = require('printf'),
    security = require('./security'),
    filterUtil = require('./filter'),
    ctrlUtilFn = require('./ctrlutil'),
    routerConfig = require('./router'),
    logger = icFrame.logger,
    config = icFrame.config,
    memwatch = icFrame.memwatch;

function normalize(p) {
    return path.normalize(p).replace(/(^\/|\/$)/g, '');
}

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
            var numReqs = 0,
                env = config.env,
                appRender = app.render,
                viewCfg = config.view,
                engines = viewCfg.engines,
                exts = Object.keys(engines),
                errorHandler = express.errorHandler();

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
            if (typeof viewCfg.data == 'object') {
                Object.keys(viewCfg.data).forEach(function(key) {
                    app.locals[key] = viewCfg.data[key];
                });
            }

            // disabled x-powered-by
            app.disable('x-powered-by');
            if (typeof config.express == 'object') {
                Object.keys(config.express).forEach(function(key) {
                    app.set(key, config.express[key]);
                });
            }

            // rewrite template render, may be render time too long
            app.render = function(name, options, fn) {
                var timer, _fn, wrapFn = function(fn) {
                    return function() {
                        clearTimeout(timer);
                        fn.apply(this, arguments);
                    };
                };

                if ('function' == typeof fn) {
                    _fn = fn = wrapFn(fn);
                }
                // support callback function as second arg
                if ('function' == typeof options) {
                    _fn = options = wrapFn(options);
                }

                timer = setTimeout(function() {
                    clearTimeout(timer);
                    _fn(new Error('template "' + name + '" render fail or timeout!'));
                }, viewCfg.timeout);

                appRender.call(app, name, options, fn);
            };

            // config default favicon. for example: express.favicon('xxx/xxx.ico');
            // ref: http://www.senchalabs.org/connect/middleware-favicon.html
            app.use(express.favicon());


            if (config.accesslog) {
                // ref: http://www.senchalabs.org/connect/logger.html
                app.use(express.logger(config.accesslog));
            }

            // parse post data (request body)
            app.use(express.bodyParser());

            // Compress response data with gzip / deflate
            config.gzip && app.use(express.compress());

            // Parse Cookie header and populate req.cookies with an object keyed by the cookie names
            // ref: http://expressjs.com/api.html#cookieParser
            app.use(express.cookieParser(config.cookie && config.cookie.secret));

            // validator utils
            app.use(expressValidator);

            // security: xss, csrf, sqli...
            app.use(security);

            // convert hidden _method to http method 
            // [client] <input type="hidden" name="_method" value="put" />
            // [server]
            // app.put('/users/:id', function (req, res, next) {
            //       // edit your user here
            // });
            // ref: http://www.senchalabs.org/connect/methodOverride.html
            app.use(express.methodOverride());

            // Session config
            if (config.session) {
                if (config.session.cookie && config.session.cookie.expires) {
                    config.session.cookie.expires = new Date(config.session.cookie.expires);
                }
                if (typeof config.session.store == 'function') {
                    config.session.store = config.session.store(express);
                }
            }
            app.use(express.session(config.session));

            if ('development' == env) {
                errorHandler = express.errorHandler({
                    dumpExceptions: true,
                    showStack: true
                });
            }
            // add sendError method
            app.use(function(req, res, next) {
                res.sendError = function(err) {
                    errorHandler.call(app, err, req, res);
                };
                next();
            });

            app.use(app.router);

            app.use(errorHandler);

        },
        // get controller instance, cache controller
        _getInstance: function(fileName) {
            var controllerRegistry = this.controllerRegistry,
                filePath,
                controller,
                instance = controllerRegistry[fileName];

            if (!(fileName in controllerRegistry)) {
                // all contrller path and file name must lowercase, named use underscore
                filePath = path.join(config.ctrlpath, fileName.toLowerCase() + '.js');
                if (fs.existsSync(filePath)) {
                    controller = require(filePath);
                    instance = new controller();
                }
                controllerRegistry[fileName] = instance;
            }
            return instance;
        },
        _getUrlConfig: function(url) {

            var self = this,
                urlConfig = this.urlConfig,
                curConfig, success, instance, filepath, action;

            url = normalize(url);
            curConfig = urlConfig[url];

            if (!curConfig || !curConfig['parsed']) {
                !curConfig && (curConfig = urlConfig[url] = {});
                curConfig.url = url;
                curConfig.mappedUrl = curConfig.mappedUrl || url;

                filepath = curConfig.mappedUrl.split('/');
                realAction = action = (filepath.pop() || DEFAULT_ACTION);

                // action Must not leading with '_'
                if (action.indexOf('_') != 0) {
                    instance = self._getInstance(filepath.join('/') || DEFAULT_CTRL);
                    success = instance && instance[realAction];

                    if (!success) {
                        filepath.push(action);
                        realAction = DEFAULT_ACTION;
                        instance = self._getInstance(filepath.join('/') || DEFAULT_CTRL);
                        success = instance && instance[realAction];
                    }
                }

                if (success) {
                    utils.mixin(curConfig, {
                        instance: instance,
                        filepath: filepath.join('/') || DEFAULT_CTRL,
                        controller: filepath.pop() || DEFAULT_CTRL,
                        action: realAction
                    });

                    if (curConfig.view) {
                        curConfig.view = normalize(curConfig.view);
                    }

                    curConfig.view = self._getViewPath(curConfig);
                    curConfig.callback = self._getCallback(curConfig);
                } else {
                    curConfig.callback = function(req, res, next) {
                        return next();
                    };
                }

                curConfig.parsed = true;

                if (config.debug) {
                    if (!success) {
                        logger.console('Can\'t find the processor for url(callback) [' + url + '].', true);
                    } else {
                        logger.console(curConfig, true, 'URL_CONFIG for ' + url);
                    }
                }
            }
            return urlConfig[url];
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
                        ext = ('.' != ext[0] ? '.' : '') + ext;
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
                filter = filterUtil.getActionFilter(instance, action),
                nowTime = Date.now,
                before = filter.before,
                after = filter.after,
                debug = config.debug;

            return function(req, res, next) {
                var args = arguments,
                    ctrlUtil = new ctrlUtilFn(),
                    callback = instance[action],
                    // monitor vars
                    hd, beginTime, timeTemp,
                    monitor = {},
                    processState = 0,
                    resEnd = res.end,
                    resWrite = res.write,
                    onEnd = function(abort) {
                        if (!abort && ++processState < 2) return;
                        process.emit('REQUEST_END');
                    };

                if (debug) {
                    // for debug performance
                    hd = new memwatch.HeapDiff();
                    beginTime = nowTime();
                    monitor = {
                        memwatch: null,
                        time: {}
                    };
                    onEnd = function() {
                        if (!monitor.aborted && ++processState < 2) return;

                        monitor.memwatch = hd.end();
                        monitor.time.total = nowTime() - beginTime + 'ms';
                        monitor.url = req.originalUrl;
                        monitor.processor = filepath + '.' + action;

                        logger.console(monitor, true, 'MEMORY AND RUNTIME');

                        process.emit('REQUEST_END');
                    };
                }

                // rewrite next() callback to empty, one action one callback
                args[2] = function() {};

                process.emit('REQUEST_START');

                res.once('close', function() {
                    ctrlUtil.set('valid', false);
                    monitor.aborted = true;
                    onEnd();
                });

                // avoid repeat res.end call
                res.isEnded = false;
                // auto write header for chunked output
                res.write = function(msg) {
                    !res.headersSent && !res.get('Content-Type') && ctrlUtil._writeHead();
                    resWrite.apply(res, arguments);
                };
                res.end = function() {
                    if (!res.isEnded) {
                        resEnd.apply(res, arguments);
                        res.isEnded = true;
                        //delete req.ctrlUtil;
                        onEnd();
                    }
                };

                // async method
                // render can called more times, use trunked model
                ['render', 'send', 'json', 'jsonp'].forEach(function(key) {
                    var callback = res[key];
                    res[key] = function() {
                        var tagName = (key == 'render') && arguments[2] || ('function' == typeof arguments[1]) ? 'chunked' : 'async';
                        ctrlUtil.set(tagName, true);
                        callback.apply(res, arguments);
                    };
                });

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

                    __syncStack__: [],
                    __chunked__: false,

                    __async__: false
                });

                req.ctrlUtil = ctrlUtil;
                req.sign_id = function(t) {
                    return printf('%u', (((t.getUTCSeconds() * 100000 + t.getUTCMilliseconds() * 1000 / 10) & 0x7FFFFFFF) | 0x80000000));
                }(new Date());

                // default header setting
                res.charset = (config.charset || 'utf-8');
                res.mimeType = 'html';

                // ============= Before Filter ===============
                if (before) {
                    timeTemp = nowTime();
                    Object.keys(before).forEach(function(key) {
                        before[key].apply(instance, args);
                    });
                    debug && (monitor.time.beforeFilter = nowTime() - timeTemp + 'ms');
                }
                // ========== End Before Filter ==============

                // run user callback
                if (typeof callback == 'function') {
                    callback.apply(instance, args);
                } else if (callback == 'SHOW_VIEW') {
                    ctrlUtil.render();
                } else {
                    res.send(callback);
                }
                // process queue: run chunkedQueue or end the response
                ctrlUtil.runQueue();

                // ============= After Filter ===============
                // usually Used to write log...
                if (after) {
                    timeTemp = nowTime();
                    Object.keys(after).forEach(function(key) {
                        after[key].apply(instance, args);
                    });
                    debug && (monitor.time.afterFilter = nowTime() - timeTemp + 'ms');
                }
                onEnd();
                // ========== After Before Filter ===========
            };
        },
        // entry
        configRouter: function() {
            var self = this;

            // merge routerConfig to urlDataInfo During initialization
            utils.mixin(this.urlConfig, routerConfig);

            // custom router. item format: {url: {url:'', meythod:'', mappedUrl:'', view:''}}
            Object.keys(routerConfig).forEach(function(url) {
                var urlConfig = self.urlConfig[url],
                    mappedUrl, callback;

                mappedUrl = urlConfig.mappedUrl = normalize(urlConfig.mappedUrl || url);
                if (~mappedUrl.indexOf(':')) {
                    callback = function(req, res) {
                        var url = req.path,
                            _urlConfig = self.urlConfig[url],
                            _callback;

                        if (!_urlConfig) {
                            _urlConfig = utils.mixin({}, urlConfig);
                            self.urlConfig[url] = utils.mixin(_urlConfig, {
                                url: url,
                                mappedUrl: mappedUrl.replace(/:([^\/]+)/g, function(o, name) {
                                    return req.params[name];
                                })
                            });
                            _urlConfig = self._getUrlConfig(url);
                        }
                        return _urlConfig.callback.apply(this, arguments);
                    }
                } else {
                    callback = self._getUrlConfig(url).callback;
                }
                app[urlConfig.method](url, callback);
            });

            // default router
            app.all('*', function(req, res, next) {
                self._getUrlConfig(req.path).callback.apply(this, arguments);
            });
        }
    };
APP.init();
module.exports = APP;