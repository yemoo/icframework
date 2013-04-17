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

var START = 0, PROCESS_END = 1, COMPLETE = 2;

var APP = {
    /**
     * Initialize the server
     */
    init: function() {
        // controller cache
        this.controllerRegistry = {};
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

        // parse post data (request body)
        app.use(express.bodyParser());

        // Compress response data with gzip / deflate
        app.use(express.compress());

        // Parse Cookie header and populate req.cookies with an object keyed by the cookie names
        // ref: http://expressjs.com/api.html#cookieParser
        app.use(express.cookieParser(config.secretKey));
        // Provides cookie-based sessions, and populates req.session
        // ref: http://expressjs.com/api.html#cookieSession
        app.use(express.session({
            secret: config.secretKey,
            key: config.secretKey.toUpperCase() + '_SID'
        }));

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
            }
            controllerRegistry[fileName] = instance;
        }
        return instance;
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
    makeCallback: function(instance, action, item) {
        var view = this._getViewPath(item),
            filter = require('./filter').getActionFilter(instance, action),
            nowTime = Date.now,
            before = filter.before,
            after = filter.after;

        return function(req, res, next) {
            var args = arguments,
                hd = new icFrame.memwatch.HeapDiff(),
                monitor = {
                    memwatch: null,
                    time: [nowTime()]
                }, processState = START,
                onEnd = function(abort) {
                    if (processState == COMPLETE || processState == START) return;
                    abort && (monitor.abort = 1);
                    monitor.memwatch = hd.end();
                    console.log(monitor);
                    process.send({
                        cmd: 'REQUEST_END'
                    });
                    processState = COMPLETE;
                },
                _ctrlUtil;
            // rewrite next() callback to empty, one action one callback
            args[2] = function() {};

            process.send({
                cmd: 'REQUEST_START'
            });
            res.once('close', function() {
                _ctrlUtil.set('valid', false);
                onEnd(true);
            });
            // rewrite res.write and res.end method
            var resWrite = res.write;
            res.write = function() {
                // auto write head
                _ctrlUtil.__writeHead();
                resWrite.apply(res, arguments);
            };
            var resEnd = res.end;
            res.__isEnded__ = false;
            // avoid repeat res.end call
            res.end = function() {
                if (!res.__isEnded__) {
                    res.__isEnded__ = true;
                    monitor.time[5] = nowTime();
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
                __controller__: instance.ctrlName,
                __action__: action,

                __syncStack__: [],
                __async__: false
            });
            // default header setting
            res.charset = (icFrame.config.charset || 'utf-8');
            res.mimeType = 'html';

            monitor.time[1] = nowTime();
            // ============= Before Filter ===============
            if (before) {
                Object.keys(before).forEach(function(key) {
                    before[key].apply(instance, args);
                });
            }
            // ========== End Before Filter ==============

            monitor.time[4] = nowTime();
            // run user callback
            instance[action].apply(instance, args);
            // process queue: run asyncQueue or end the response
            _ctrlUtil.runQueue();

            monitor.time[2] = nowTime();
            // ============= After Filter ===============
            // usually Used to write log...
            if (after) {
                Object.keys(after).forEach(function(key) {
                    after[key].apply(instance, args);
                });
            }
            monitor.time[3] = nowTime();
            processState = PROCESS_END;
            onEnd();
            // ========== After Before Filter ===========
        };
    },
    // parse router config
    // return router callback or error info
    // item: {url:'/user', method:'get', callback:'user.list', view:''}
    // return: {callback: [Function], error: false} OR {error: true, errorMsg: ''}
    parseRouter: function(item) {
        // config.callback: "position/list.index"
        var callback = item.callback.split('.'),
            ctrlName = callback[0],
            // action use Camelize Naming method
            actionName = utils.string.camelize(callback[1] || 'index'),
            // get controller
            instance = this._getInstance(ctrlName),
            errorMsg;

        // action Must a function, and not leading with '__'
        if (actionName.indexOf('__') == 0) {
            actionName = 'index';
        }
        // controller/action has found
        if (instance && typeof instance[actionName] == 'function') {
            instance.ctrlName = ctrlName;
            return {
                callback: this.makeCallback(instance, actionName, item),
                error: false
            };
        } else {
            errorMsg = (instance ? ('Action ' + ctrlName + '.' + actionName) : 'Controller ' + ctrlName) + ' not Exist!';
            //icFrame.logger.log('warn', errorMsg);
            return {
                error: true,
                errorMsg: errorMsg
            };
        }
    },
    // entry
    configRouter: function() {
        var self = this,
            newReqCache = this.newReqCache,
            userRouter = require('./router');

        // item: {url:'', method:'', callback:'', view:''}
        userRouter.forEach(function(item) {
            var config = self.parseRouter(item);
            // find action map from controllerRegister cache
            if (!config.error) {
                //method = queuemanager.method(method);
                app[item.method](item.url, config.callback);
            } else {
                icFrame.logger.info(config.errorMsg);
            }
        });

        // default router
        app.all('*', function(req, res, next) {
            var url = req.path.replace(/(^\/|\/$)/g, ''), // '/aaa/bbb/' = 'aaa/bbb',
                config = newReqCache[url],
                controllerExist,
                controller,
                action;

            // only parse one time for every url
            if (!config) {
                // more than one level: 'aaa/bbb', 'aaa/vvv/ccc'
                if (~url.indexOf('/')) {
                    controller = url.split('/');
                    action = controller.pop();
                    controllerExist = self._getInstance(controller.join('/'));
                    if (!controllerExist) {
                        controller.push(action);
                        action = 'index';
                        controllerExist = self._getInstance(controller.join('/'));
                    }
                    controller = controller.join('/');
                } else {
                    // one level: 'aaa', 'bbb'
                    action = 'index';
                    controllerExist = self._getInstance(url);
                    controller = url;
                }

                if (controllerExist) {
                    // controller has found
                    config = self.parseRouter({
                        url: url,
                        method: 'all',
                        callback: controller + '.' + action
                    });
                } else {
                    // 404 not found, use express internal process
                    config = {
                        callback: function(req, res, next) {
                            return next();
                        }
                    };
                }
                newReqCache[url] = config;
            }

            !config.error ? config.callback.apply(this, arguments) : res.end(config.errorMsg);
        });
    }
};
APP.init();
module.exports = app;