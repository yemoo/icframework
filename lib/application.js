var express = require('express'),
    app = express(),
    consolidate = require('consolidate'),
    utils = require('utilities'),
    fs = require('fs'),
    path = require('path'),
    security = require('./security'),
    ctrlUtil = require('./ctrlutil');

function getSignId() {
    var t = new Date();
    return require('printf')('%u', (((t.getUTCSeconds() * 100000 + t.getUTCMilliseconds() * 1000 / 10) & 0x7FFFFFFF) | 0x80000000));
}

var APP = {
    /**
     * Initialize the server
     */
    init: function() {
        // controller cache
        this.controllerRegistry = {};
        this.url2Processor = {};
        // view cache
        this.viewRegistry = {};
        // default req action cacheMap
        this.newReqCache = {};

        // config app
        this.configApp();
        // config request route
        this.configRouter();
    },
    configApp: function() {
        var config = icFrame.config,
            numReqs = 0,
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
        if (config.express) {
            for (var key in config.express) {
                app.set(key, config.express[key]);
            }
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
        app.use(express.cookieParser(config.secretKey));

        // Session
        var sessionOption = {
            secret: config.secretKey,
            key: config.secretKey.toUpperCase() + '_SID'
        };
        if (config.sessionStore) {
            sessionOption.store = config.sessionStore(express);
        }
        app.use(express.session(sessionOption));

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
        // force check router before static-files check
        app.use(app.router);

        // static dir
        if (config.staticDir) {
            app.use(express.static(config.staticDir));
        }

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
            filePath = path.join(icFrame.config.controllerDir, fileName.toLowerCase() + '.js');
            if (fs.existsSync(filePath)) {
                controller = require(filePath);
                instance = new controller();
                instance.ctrlName = fileName;
            }
            controllerRegistry[fileName] = instance;
        }
        return instance;
    },
    _parseFromUrl: function(url, showError) {
        var self = this,
            url2Processor = this.url2Processor,
            success, controller, action, instance;

        if (!(url in url2Processor)) {
            controller = url.split('/');
            action = controller.pop();
            realAction = action,
            instance = self._getInstance(controller.join('/') || 'index');

            // action Must a function, and not leading with '__'
            if (action.indexOf('__') == 0) {
                realAction = 'index';
            }
            success = instance && instance[realAction];
            if (!success) {
                controller.push(action);
                realAction = 'index';
                instance = self._getInstance(controller.join('/') || index);
                success = instance && instance[realAction];
            }

            url2Processor[url] = success ? {
                instance: instance,
                ctrlName: instance.ctrlName,
                actionName: realAction
            } : false;

            if (showError && !success) {
                icFrame.logger.info('Can\'t find the processor for url(callback) [' + url + '].');
            }
        }
        return url2Processor[url];
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
    _getViewPath: function(config) {
        var self = this,
            viewPath = config.view,
            cacheKey = viewPath,
            viewExt = '.' + icFrame.config.viewEngine,
            url;

        if (!viewPath) {
            if (config.url) {
                // '/aaa/bbb/' = 'aaa/bbb'
                url = config.url.replace(/(^\/|\/$)/, '');
                cacheKey = url + config.method;
            } else {
                throw new Error('Can\'t find views with config: ' + (config ? 'NULL' : JSON.stringify(config)));
            }
        }

        if (!this.viewRegistry[cacheKey]) {
            // user define viewPath
            if (viewPath) {
                var ext = path.extname(viewPath);
                if (!ext) {
                    // add default ext
                    viewPath += viewExt;
                }
                viewPath = path.join(icFrame.config.viewDir, viewPath);
                this.viewRegistry[cacheKey] = fs.existsSync(viewPath) ? viewPath : false;
            } else {
                var realPath = icFrame.config.viewDir,
                    findView, tempVar, len;

                viewPath = url.split('/');
                len = viewPath.length;
                viewPath.every(function(fname, index, arr) {
                    tempVar = realPath + '/' + fname;
                    // find as folder, 
                    // index < arr.length - 1: force last section find as file
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
                this.viewRegistry[cacheKey] = findView ? realPath : false;
            }
        }
        return this.viewRegistry[cacheKey];
    },

    // wrap the router callback use user-custom callback
    makeCallback: function(item) {
        var view = this._getViewPath(item),
            instance = item.instance,
            ctrlName = item.ctrlName,
            actionName = item.actionName,
            filter = require('./filter').getActionFilter(instance, actionName),
            nowTime = Date.now,
            before = filter.before,
            after = filter.after,
            useMonitor = icFrame.config.monitorReq;

        return function(req, res, next) {
            var args = arguments,
                _ctrlUtil,
                resWrite = res.write,
                resEnd = res.end,
                // monitor vars
                hd, beginTime, timeTemp, monitor,
                processState = 0,
                onEnd = function(abort) {
                    if (!abort && ++processState < 2) return;
                    process.emit('REQUEST_END');
                };

            if (useMonitor) {
                // for debug performance
                hd = new icFrame.memwatch.HeapDiff();
                beginTime = nowTime();
                monitor = {
                    memwatch: null,
                    time: {}
                };
                onEnd = function(abort) {
                    if (!abort && ++processState < 2) return;

                    abort && (monitor.abort = 1);

                    monitor.memwatch = hd.end();
                    monitor.time.total = nowTime() - beginTime + 'ms';
                    monitor.url = req.originalUrl;
                    monitor.processor = ctrlName + '.' + actionName;
                    //icFrame.logger.log(JSON.stringify(monitor));
                    console.log();
                    console.log(monitor);

                    process.emit('REQUEST_END');
                };
            }

            // rewrite next() callback to empty, one action one callback
            args[2] = function() {};

            process.emit('REQUEST_START');

            res.once('close', function() {
                _ctrlUtil.set('valid', false);
                onEnd(true);
            });
            // rewrite res.write and res.end method
            res.write = function() {
                // auto write head
                _ctrlUtil.__writeHead();
                resWrite.apply(res, arguments);
            };
            res.__isEnded__ = false;
            // avoid repeat res.end call
            res.end = function() {
                if (!res.__isEnded__) {
                    res.__isEnded__ = true;
                    resEnd.apply(res, arguments);
                    onEnd();
                    /*for (var pid in completedQueue) {
                        completedQueue[pid]();
                    }*/
                }
            };

            req.sign_id = getSignId();

            _ctrlUtil = req.__ctrlUtil__ = new ctrlUtil();
            utils.mixin(_ctrlUtil, {
                __valid__: true,
                __req__: req,
                __res__: res,
                __instance__: instance,
                // bind view to the instance
                __view__: view,
                // current controller and action Name
                __controller__: ctrlName,
                __action__: actionName,

                __syncStack__: [],
                __async__: false
            });
            // default header setting
            res.charset = (icFrame.config.charset || 'utf-8');
            res.mimeType = 'html';

            // ============= Before Filter ===============
            if (before) {
                timeTemp = nowTime();
                Object.keys(before).forEach(function(key) {
                    before[key].apply(instance, args);
                });
                useMonitor && (monitor.time.beforeFilter = nowTime() - timeTemp + 'ms');
            }
            // ========== End Before Filter ==============

            // run user callback
            instance[actionName].apply(instance, args);
            // process queue: run asyncQueue or end the response
            _ctrlUtil.runQueue();

            // ============= After Filter ===============
            // usually Used to write log...
            if (after) {
                timeTemp = nowTime();
                Object.keys(after).forEach(function(key) {
                    after[key].apply(instance, args);
                });
                useMonitor && (monitor.time.afterFilter = nowTime() - timeTemp + 'ms');
            }
            onEnd();
            // ========== After Before Filter ===========
        };
    },
    // entry
    configRouter: function() {
        var self = this,
            userRouter = require('./router'),
            getCallback = function(url, extra) {
                var processor = self._parseFromUrl(url, true);
                extra = extra || {};
                if (processor) {
                    callback = self.makeCallback(utils.mixin(extra, processor));
                } else {
                    callback = function(req, res, next) {
                        return next();
                    };
                }
                return callback;
            };

        // item: {url:'', method:'', callback:'', view:''}
        userRouter.forEach(function(item) {
            app[item.method](item.url, getCallback(item.callback, item));
        });

        // default router
        app.all('*', function(req, res, next) {
            var url = req.path.replace(/(^\/|\/$)/g, ''); // '/aaa/bbb/' = 'aaa/bbb',
            getCallback(url).apply(this, arguments);
        });
    }
};
APP.init();
module.exports = app;