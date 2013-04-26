var express = require('express'),
    app = express(),
    expressValidator = require('express-validator'),
    consolidate = require('consolidate'),
    utils = require('utilities'),
    sysUtil = require('util'),
    fs = require('fs'),
    path = require('path'),
    security = require('./security'),
    ctrlUtilFn = require('./ctrlutil'),
    logger = icFrame.logger,
    config = icFrame.config,
    memwatch = icFrame.memwatch,
    getSignId = function() {
        var t = new Date();
        return require('printf')('%u', (((t.getUTCSeconds() * 100000 + t.getUTCMilliseconds() * 1000 / 10) & 0x7FFFFFFF) | 0x80000000));
    };

var DEFAULT_CTRL = 'index',
    DEFAULT_ACTION = 'index';

var APP = {
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
            viewEngineMap = config.viewEngineMap;

        // init all view engines
        Object.keys(viewEngineMap).forEach(function(viewExt) {
            app.engine(viewExt, viewEngineMap[viewExt](consolidate));
        });
        // set the default extension 
        app.set('view engine', config.viewEngine);
        app.set('view cache', config.viewCache);
        // default view path
        app.set('views', config.viewDir);

        // disabled x-powered-by
        app.disable('x-powered-by');
        if (typeof config.express == 'object') {
            Object.keys(config.express).forEach(function(key) {
                app.set(key, config.express[key]);
            });
        }

        if (typeof config.locals == 'object') {
            Object.keys(config.locals).forEach(function(key) {
                app.locals[key] = config.locals[key];
            });
        }

        //var pid, completedQueue = {};
        //var maxReqsPerChild = config.maxReqsPerChild;
        /*app.use(function(req, res, next) {
            if (++numReqs > maxReqsPerChild) {
                //process.emit('stopprocess');
                //process.send('stopprocess');
                // stop process new request
                pid = process.pid;
                completedQueue[pid] = function() {
                    delete completedQueue[pid];
                    process.kill(pid);
                };
                res.once('close', completedQueue[pid]);
            }
            next();
        });*/

        // config default favicon. for example: express.favicon('xxx/xxx.ico');
        // ref: http://www.senchalabs.org/connect/middleware-favicon.html
        app.use(express.favicon());

        // request logging
        if (config.logger) {
            config.logger.format = config.logger.format || ':remote-addr - - [:date] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" - :response-time ms';
            // ref: http://www.senchalabs.org/connect/logger.html
            app.use(express.logger(config.logger));
        }

        // parse post data (request body)
        app.use(express.bodyParser());

        // Compress response data with gzip / deflate
        config.gzip && app.use(express.compress());

        // Parse Cookie header and populate req.cookies with an object keyed by the cookie names
        // ref: http://expressjs.com/api.html#cookieParser
        app.use(express.cookieParser(config.cookie && config.cookie.secret));

        // Session
        if(config.session && typeof config.session.store == 'function'){
            config.session.store = config.session.store(express);
        }
        app.use(express.session(config.session));

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

        // show responseTime in header
        if ('development' == env) {
            app.use(express.responseTime());
        }

        // static dir
        if (config.staticDir) {
            app.use(express.static(config.staticDir));
        }
        // force check router before static-files check
        app.use(app.router);

        if ('development' == env) {
            app.use(express.errorHandler({
                dumpExceptions: true,
                showStack: true
            }));
        } else if ('production' == env) {
            app.use(express.errorHandler());
        }
    },
    // get controller instance, cache controller
    _getInstance: function(fileName) {
        var controllerRegistry = this.controllerRegistry,
            filePath,
            controller,
            instance = controllerRegistry[fileName];

        if (!(fileName in controllerRegistry)) {
            // all contrller path and file name must lowercase, named use underscore
            filePath = path.join(config.controllerDir, fileName.toLowerCase() + '.js');
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
            curConfig = urlConfig[url],
            success, instance, filepath, action;

        if (!curConfig || !curConfig['parsed']) {
            !curConfig && (curConfig = urlConfig[url] = {});
            curConfig.url = url;
            curConfig.mappedUrl = curConfig.mappedUrl || url.replace(/(^\/|\/$)/g, '');

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
                curConfig.view = self._getViewPath(curConfig);
                curConfig.callback = self._getCallback(curConfig);
            } else {
                curConfig.callback = function(req, res, next) {
                    return next();
                };
            }

            curConfig.parsed = true;

            if (config.debug && !success) {
                logger.debug('Can\'t find the processor for url(callback) [' + url + '].');
            }

            config.debug && logger.debug(sysUtil.inspect(curConfig));
        }
        return urlConfig[url];
    },
    _findAsFile: function(realPath, viewExt) {
        if (realPath[realPath.length - 1] == '/') {
            realPath = realPath.substr(0, realPath.length - 1);
        }
        if (fs.existsSync(realPath + viewExt)) { // file sencond
            return realPath + viewExt;
        } else if (fs.existsSync(realPath + '/index' + viewExt)) { // last: folder + '/index.dust'
            return realPath + '/index' + viewExt;
        } else {
            return false;
        }
    },
    // '/user/list?xxx'
    _getViewPath: function(urlConfig) {
        var self = this,
            viewPath = urlConfig.view,
            cacheKey = viewPath || (urlConfig.mappedUrl + urlConfig.method),
            viewExt = '.' + config.viewEngine;

        if (!this.viewRegistry[cacheKey]) {
            // user define viewPath
            if (viewPath) {
                var ext = path.extname(viewPath);
                if (!ext) {
                    // add default ext
                    viewPath += viewExt;
                }
                viewPath = path.join(config.viewDir, viewPath);
                this.viewRegistry[cacheKey] = fs.existsSync(viewPath) ? viewPath : false;
            } else {
                var realPath = config.viewDir,
                    findView, tempVar, len;

                viewPath = urlConfig.mappedUrl.split('/');
                len = viewPath.length;
                viewPath.every(function(fname, index, arr) {
                    tempVar = realPath + '/' + fname;
                    // find as folder except last section
                    if (index < len - 1 && fs.existsSync(tempVar)) {
                        realPath = tempVar;
                        return true;
                    } else {
                        // find as file
                        if (tempVar = self._findAsFile(tempVar, viewExt)) {
                            realPath = tempVar;
                            findView = true;
                        }
                        // folder not found, exit the iterate
                        return false;
                    }
                });
                // [auto use parent's index.dust]: replace 'false' to 'this._findAsFile(realPath, viewExt)'
                // temporary force exact match
                this.viewRegistry[cacheKey] = findView ? path.normalize(realPath) : false;
            }
        }
        return this.viewRegistry[cacheKey];
    },

    // wrap the router callback use user-custom callback
    _getCallback: function(urlConfig) {
        var instance = urlConfig.instance,
            filepath = urlConfig.filepath,
            controller = urlConfig.controller,
            action = urlConfig.action,
            view = urlConfig.view,
            filter = require('./filter').getActionFilter(instance, action),
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

                    logger.debug(sysUtil.inspect(monitor, {
                        depth: null
                    }));

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

            // rewrite res.write and res.end method
            /*res._write = res._write || res.write;
            res.write = function() {
                ctrlUtil._writeHead();
                res._write.apply(res, arguments);
            };*/

            // avoid repeat res.end call
            res.__isEnded__ = false;
            res.end = function(data) {
                if (arguments.length && typeof data != 'string') {
                    return res.send.apply(res, arguments);
                }
                if (!res.__isEnded__) {
                    res.__isEnded__ = true;
                    resEnd.apply(res, arguments);
                    delete req.ctrlUtil;
                    onEnd();
                    //for (var pid in completedQueue) {
                    //    completedQueue[pid]();
                    //}
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

            req.sign_id = getSignId();
            req.ctrlUtil = ctrlUtil;

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
        var self = this,
            routerConfig = require('./router');

        // merge routerConfig to urlDataInfo During initialization
        utils.mixin(this.urlConfig, routerConfig);

        // custom router. item format: {url: {url:'', meythod:'', mappedUrl:'', view:''}}
        Object.keys(routerConfig).forEach(function(url) {
            var urlConfig = self.urlConfig[url],
                mappedUrl, callback;

            mappedUrl = urlConfig.mappedUrl = (urlConfig.mappedUrl || url).replace(/(^\/|\/$)/g, '');
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