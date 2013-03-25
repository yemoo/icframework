/**
 * Module dependencies.
 */

var express = require('express'),
    app = express(),
    consolidate = require('consolidate'),
    utils = require('utilities'),
    fs = require('fs'),
    path = require('path'),
    instancectrl = require('./instancectrl');

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

        return app;
    },
    configApp: function() {
        var config = icFrame.config,
            env = config.env,
            viewEngineMap = require('../config/viewengine'),
            appViewEngineFile = path.join(config.configDir, 'viewengine.js');

        // user customer engineMap
        if (fs.existsSync(appViewEngineFile)) {
            viewEngineMap = utils.mixin(viewEngineMap, require(appViewEngineFile));
        }

        // init all view engines
        Object.keys(viewEngineMap).forEach(function(viewExt) {
            app.engine(viewExt, viewEngineMap[viewExt](consolidate));
        });
        // set the default extension 
        app.set('view engine', config.viewEngine);
        app.set('view cache', config.viewCache);
        // default view path
        app.set('views', config.viewDir);

        if (config.express) {
            for (var key in config.express) {
                app.set(key, config.express[key]);
            }
        }

        // config default favicon. for example: express.favicon('xxx/xxx.ico');
        // ref: http://www.senchalabs.org/connect/middleware-favicon.html
        app.use(express.favicon());

        // parse post data (request body)
        app.use(express.bodyParser());

        // Compress response data with gzip / deflate
        app.use(express.compress());

        // convert hidden _method to http method 
        // [client] <input type="hidden" name="_method" value="put" />
        // [server]
        // app.put('/users/:id', function (req, res, next) {
        //       // edit your user here
        // });
        // ref: http://www.senchalabs.org/connect/methodOverride.html
        app.use(express.methodOverride());

        // Parse Cookie header and populate req.cookies with an object keyed by the cookie names
        // ref: http://expressjs.com/api.html#cookieParser
        app.use(express.cookieParser(config.secretKey));
        // Provides cookie-based sessions, and populates req.session
        // ref: http://expressjs.com/api.html#cookieSession
        app.use(express.session({
            secret: config.secretKey
        }));

        // rewrite res.end()
        app.use(function(req, res, next) {
            var end = res.end;
            res.__isEnded__ = false;
            res.end = function() {
                res.__isEnded__ = true;
                end.apply(end, arguments);
            };
            next();
        });

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
    _getCtrlInstance: function(fileName) {
        var controllerRegistry = this.controllerRegistry,
            instance,
            filePath;

        if (!(fileName in controllerRegistry)) {
            // all contrller path and file name must lowercase, named use underscore
            filePath = path.join(icFrame.config.controllerDir, fileName.toLowerCase() + '.js');
            instance = controllerRegistry[fileName] = fs.existsSync(filePath) ? instancectrl(require(filePath)) : false;
        }
        return controllerRegistry[fileName];
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
            url = config.url.replace(/(^\/|\/$)/, ''), // '/aaa/bbb/' = 'aaa/bbb'
            cacheKey = viewPath ? viewPath : (url + config.method);

        if (!this.viewRegistry[cacheKey]) {
            // user define viewPath
            if (viewPath) {
                viewPath = path.join(icFrame.config.viewDir, viewPath);
                this.viewRegistry[cacheKey] = fs.existsSync(viewPath) ? viewPath : false;
            } else {
                var realPath = icFrame.config.viewDir,
                    viewExt = '.' + icFrame.config.viewEngine,
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
            before = filter.before,
            after = filter.after;

        return function(req, res, next) {
            var args = arguments;
            /* init the state vars every request */
            // record instance.action's current arguments
            instance.__actionargs__ = args;
            // bind view to the instance
            instance.__view__ = view;
            // init state for instance
            instance.__syncStack__ = [];
            instance.__async__ = false;
            // rewrite next() callback 
            // remove express router multi callback support
            next = function() {};
            
            // ============= Before Filter ===============
            if (before) {
                Object.keys(before).forEach(function(key) {
                    before[key].apply(this, args);
                }, instance);
            }
            // ========== End Before Filter ==============

            // run user callback
            instance[action].apply(instance, args);
            // run asyncQueue or end the response
            instance._runQueue();

            // ============= After Filter ===============
            // usually Used to write log...
            if (after) {
                Object.keys(after).forEach(function(key) {
                    after[key].apply(this, args);
                }, instance);
            }
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
            controller = callback[0],
            // action use Camelize Naming method
            action = utils.string.camelize(callback[1] || 'index'),
            // get controller instance
            instance = this._getCtrlInstance(controller),
            errorMsg;

        // controller/action has found
        if (instance && instance[action]) {
            return {
                callback: this.makeCallback(instance, action, item),
                error: false
            };
        } else {
            errorMsg = (instance ? ('Action ' + controller + '.' + action) : 'Controller ' + controller) + ' not Exist!';
            icFrame.logger.log('warn', msg);
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
                res.end(config.msg);
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
                    controllerExist = self._getCtrlInstance(controller.join('/'));
                    if (!controllerExist) {
                        action = 'index';
                        controller.push(action);
                        controllerExist = self._getCtrlInstance(controller.join('/'));
                    }
                    controller = controller.join('/');
                } else {
                    // one level: 'aaa', 'bbb'
                    action = 'index';
                    controllerExist = self._getCtrlInstance(url);
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

module.exports = APP.init();