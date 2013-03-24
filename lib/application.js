/**
 * Module dependencies.
 */

var express = require('express'),
    app = express(),
    consolidate = require('consolidate'),
    utils = require('utilities'),
    fs = require('fs'),
    urlParser = require('url').parse,
    path = require('path');

var APP = {
    /**
     * Initialize the server
     */
    init: function() {
        this.controllerRegistry = {};
        this.viewRegistry = {};
        // default req action cacheMap
        this.newReqCache = {};

        // config app
        this.configApp();
        this.configRouter();

        return app;
    },
    configApp: function() {
        var config = icFrame.config,
            configPath = config.configPath,
            env = config.environment,
            viewEngineMap = require('../config/viewengine');

        // user customer engineMap
        if (fs.existsSync(configPath + '/viewengine' + '.js')) {
            viewEngineMap = utils.mixin(viewEngineMap, require(configPath + '/viewengine'));
        }

        // init all view engines
        Object.keys(viewEngineMap).forEach(function(viewExt) {
            app.engine(viewExt, viewEngineMap[viewExt](consolidate));
        });
        // set the default extension 
        app.set('view engine', config.viewEngine);
        app.set('view cache', config.viewCache);
        // default view path
        app.set('views', config.views);

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
    _getController: function(fileName) {
        var controllerRegistry = this.controllerRegistry,
            filePath;

        if (!(fileName in controllerRegistry)) {
            filePath = icFrame.config.controllerDir + '/' + fileName.toLowerCase() + '.js';
            controllerRegistry[fileName] = fs.existsSync(filePath) ? new(require(filePath))() : false;
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
    _getViewPath: function(viewPath, url, method) {
        var self = this,
            cacheKey = viewPath ? viewPath : (url + method),
            viewExt = '.' + icFrame.config.viewEngine,
            realPath = icFrame.config.viewDir,
            findView,
            tempVar, len;

        if (this.viewRegistry[cacheKey]) {
            return this.viewRegistry[cacheKey];
        }

        // user set
        if (viewPath) {
            viewPath = realPath + (viewPath[0] == '/' ? '' : '/') + viewPath;
            realPath = fs.existsSync(viewPath) ? viewPath : false;
        } else {
            // parse url
            viewPath = urlParser(url).pathname;
            // remove start slash '/aaa' => 'aaa'
            if ('/' == viewPath[0]) {
                viewPath = viewPath.substr(1);
            }

            viewPath = viewPath.split('/');
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
            // console.log(viewPath, findView, realPath);
            // [auto use parent's index.dust]: replace 'false' to 'this._findAsFile(realPath, viewExt)'
            // temporary force exact match
            realPath = findView ? realPath : false;
        }

        return this.viewRegistry[cacheKey] = realPath;
    },
    parseRouter: function(item) {
        var config = item.config,
            view = this._getViewPath(config.view, item.url, item.method),
            callback = config.callback.split('.'),
            controller = callback[0],
            action = callback[1] || 'index',
            instance = this._getController(controller),
            msg;

        if (instance && instance[action]) {
            // bind view to the instance
            instance.view = view;
            return {
                fn: instance[action].bind(instance), //queuemanager.callback(_.bind(instance[action], instance)),
                error: false
            };
        } else {
            msg = (instance ? ('Action ' + controller + '.' + action) : 'Controller ' + controller) + ' not Exist!';
            icFrame.logger.log('warn', msg);
            return {
                error: true,
                msg: msg
            };
        }
    },
    _runCallback: function(config, req, res, next) {
        if (!config.error) {
            config.fn(req, res, next);
        } else {
            res.end(config.msg);
        }
    },
    configRouter: function() {
        var self = this,
            userRouter = require('./router');

        // item: {url, method, config: {callback:, view:}}
        userRouter.forEach(function(item) {
            var config = self.parseRouter(item);
            // find action map from controllerRegister cache
            if (!config.error) {
                //method = queuemanager.method(method);
                app[item.method](item.url, config.fn);
            } else {
                res.end(config.msg);
            }
        });

        // default router
        app.all('*', function(req, res, next) {
            var url = req.path.substr(1),
                view = self._getViewPath(null, req.path),
                callback = url.split('/'),
                newReqCache = self.newReqCache,
                controllerExist,
                controller,
                action,
                config;

            if (!newReqCache[url]) {
                if (callback.length > 1) {
                    action = callback.pop();

                    controllerExist = self._getController(callback.join('/'));
                    if (!controllerExist) {
                        action = 'index';
                        callback.push(action);
                        controllerExist = self._getController(callback.join('/'));
                    }

                    controller = callback.join('/');
                } else {
                    action = 'index';
                    controllerExist = self._getController(url);
                    controller = url;
                }

                if (controllerExist) {
                    newReqCache[url] = self.parseRouter({
                        url: url,
                        method: 'all',
                        config: {
                            callback: controller + '.' + action
                        }
                    });
                } else {
                    newReqCache[url] = {
                        fn: function(req, res, next) {
                            res.statusCode = 404;
                            res.setHeader('Content-Type', 'text/plain');
                            if ('HEAD' == req.method) return res.end();
                            res.end('Cannot ' + req.method + ' ' + req.originalUrl);
                        }
                    };
                }
            }
            self._runCallback(newReqCache[url], req, res, next);
        });
    }
};


/*app.get('/', function(req, res, next) {
    res.write("ok");

    // callback ,user global level timeout
    icFrame.submitJob('reverse', " Hello World", function(job) {
        console.log(job.payload.toString());
    });

    // job level timeout
    icFrame.submitJob('reverse', " Hello World", {
        fn: function(job) {
            console.log(job.payload.toString());
        },
        timeout: 3000
    });

    console.log('the pid: ' + process.pid);
    res.end();
});*/

module.exports = APP.init();