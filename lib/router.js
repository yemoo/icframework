var fs = require('fs'),
    routerRegistry = [],
    router = {
        init: function() {
            var self = this,
                routeFile = icFrame.config.configDir + '/router' + '.js',
                routerConfig = {};


            if (fs.existsSync(routeFile)) {
                routerConfig = require(routeFile);
            }

            // custom router
            Object.keys(routerConfig).forEach(function(url) {
                self._parseRouter(url, routerConfig[url]);
            });
        },
        // config must be a object type
        _addRouter: function(url, method, config) {
            routerRegistry.push({
                url: url,
                method: method,
                callback: config.callback,
                view: config.view
            });
        },
        _parseRouter: function(url, config, method) {
            var self = this;

            method = method || 'all';
            if (typeof config == 'string') {
                // '/': 'User.index'
                self._addRouter(url, method, {
                    callback: config
                });
            } else if (config['callback'] || config['view']) {
                // '/index': {get:'User/index'}
                this._addRouter(url, method, config);
            } else {
                // '/user': {'get': {callback:''}}
                Object.keys(config).forEach(function(method) {
                    self._parseRouter(url, config[method], method);
                });
            }
        }
    };
router.init();
module.exports = routerRegistry;