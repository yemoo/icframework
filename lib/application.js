/**
 * Module dependencies.
 */

var express = require('express'),
    app = express(),
    consolidate = require('consolidate'),
    utils = require('utilities'),
    fs = require('fs'),
    path = require('path');

var APP = {
    /**
     * Initialize the server
     */
    init: function() {
        // config app
        this.config();

        //this.initRouter();
        //this.initController();

        return app;
    },
    config: function() {
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

        // static path
        if (config.staticPath) {
            app.use(express.static(config.staticPath));
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
    initRouter: function() {
        var self = this,
            config = icFrame.config,
            path = config.configPath + '/router' + '.js',
            routerRegistry = app.routerRegistry = {},
            processor;

        if (fs.existsSync(path)) {
            routerRegistry = require(path);
        }

        // custom router
        Object.keys(routerRegistry).forEach(function(url) {
            processor = routerRegistry[url];
            // '/': 'User.index'
            if (typeof processor == 'string') {
                self._setRouter(url, 'all', processor);
            } else if (typeof processor == 'object') {
                self._parseRouter(url, processor);
            }
        });
    },
    getCallback: function(processor) {
        processor = processor.split('.');
        var controller = processor[0],
            action = processor[1] || 'index',
            instance = app.controllerRegistry[controller],
            msg;

        if (instance && instance[action]) {
            return {
                fn: queuemanager.callback(_.bind(instance[action], instance)),
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
    _setRouter: function(url, method, processor) {
        var callback = this.getCallback(processor);
        // find action map from controllerRegister cache
        if (!callback.error) {
            //method = queuemanager.method(method);
            //app[method](url, callback.fn);
        }
    },
    _parseRouter: function(url, config, method) {
        var self = this;

        method = method || 'all';
        // '/index': {get:'User/index'}
        if (config['ctr'] || config['view']) {
            this._setRouter(url, method, config);
        } else {
            // '/user': {'get': {ctr:''}}
            Object.keys(config).forEach(function(method) {
                self._parseRouter(url, config[i], method);
            });
        }
    },
    _getController: function(item) {
        var config = icFrame.config,
            controllerPath = config.controllerPath,
            filePath = item.filePath,
            ctor;

        if (!filePath) {
            filePath = controllerPath + '/' + inflection.underscore(item.ctorName)
        }

        if (fs.existsSync(filePath + '.js')) {
            return app.controllerRegistry[item.ctorName] = new(require(filePath))();
        } else {
            return false;
        }
    },
    initController: function() {
        app.controllerRegistry = {};
    },
    start: function() {
        var self = this,
            routerRegistry = app.routerRegistry,
            url, processor;

        // custom router
        for (url in routerRegistry) {
            processor = routerRegistry[url];
            // '/': 'User.index'
            if (typeof processor == 'string') {
                this._setRouter(url, 'all', processor);
            } else if (typeof processor == 'object') { // '/index': {get:'User/index'},  '/user': {}
                this._parseRouter(url, processor);
            }
        }

        // default router
        app.all('/:controller/:action?', function(req, res, next) {
            var controller = inflection.camelize(req.params.controller),
                action = req.params.action || 'index',
                instance,
                pattern,
                processor,
                callback;

            // init controller at first visit
            instance = _initController({
                ctorName: controller
            });
            // file not exist
            if (!instance) {
                res.write('Can not get ' + req.path);
                res.end();
                return false;
            }

            pattern = '/' + req.params.controller + (req.params.action ? ('/' + req.params.action) : '');
            processor = controller + '.' + action;
            // add route
            self._parseRouter(pattern, 'all', processor);

            callback = self.getCallback(processor);
            if (callback.error) {
                res.write(callback.msg);
                res.end();
            } else {
                callback.fn.apply(this, arguments);
            }
        });
    }
};


app.get('/', function(req, res, next) {
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
});


//APP.init();
module.exports = app;