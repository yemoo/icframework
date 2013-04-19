var fs = require('fs'),
    routerRegistry = {},
    router = {
        init: function() {
            var routerConfig = {};
            icFrame.configUtil.mixConfig(routerConfig, icFrame.config.configDir + '/router.js');

            // custom router
            Object.keys(routerConfig).forEach(function(url) {
                this._parseRouter(url, routerConfig[url]);
            }, this);
        },
        // config must be a object type
        _addRouter: function(url, method, config) {
            routerRegistry[url] = {
                url: url,
                method: method,
                mappedUrl: config.mappedUrl,
                view: config.view || ''
            };
        },
        _parseRouter: function(url, config, method) {
            var self = this;

            method = method || 'all';
            if (typeof config == 'string') {
                // '/': 'User.index'
                self._addRouter(url, method, {
                    mappedUrl: config
                });
            } else if (config['mappedUrl'] || config['view']) {
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