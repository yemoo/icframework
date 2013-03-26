var utils = require('utilities'),
    express = require('express'),
    async = require('async');

module.exports = function(controller) {
    if (!controller) return controller;

    var instance = new controller();
    utils.mixin(instance, {
        __actionargs__: [],
        __view__: '',
        __action__: 'index',
        __controller__: controller.fileName,
        __syncStack__: [],
        __async__: false,
        __defaultFormat__: 'html',
        // get 
        get: function(name) {
            return this['__' + name + '__'];
        },
        set: function(name) {
            var method = '__set' + utils.string.camelize(name, {
                initialCap: true
            }),
                args;

            if (this[method]) {
                args = [].slice.call(arguments, 1);
                return this[method].apply(this, args);
            }
        },
        __setDefaultFormat: function(format) {
            if (format) {
                this.__defaultFormat__ = format;
            }
        },
        // set view for instance action
        __setView: function(view) {
            return this.__view__ = icFrame.APP._getViewPath({
                view: view
            });
        },
        // if use this method(means sync method, this will support autotype(html, json, jsonp) response), you will not able to use icRun method!
        // [options] two ways:
        //   -- 'html', 'json', 'jsonp'
        //   -- {format:'html',view: '', callback: function(){...}}, {format:'json'}
        icRender: function(data, options) {
            var view = this.__view__,
                format = this.__defaultFormat__,
                args = this.__actionargs__,
                res = args[1],
                callback;

            if (options) {
                if (typeof options == 'string') {
                    format = options;
                    options = {};
                } else {
                    // options.format override the defaultFormat
                    format = options.format || format;
                }
            }
            // options: undefined, {}, {type:'html'}
            if (format == 'html') {
                view = options.view || view; //options.view ? this.set('view', options.view) : view;
                if (view) {
                    // callback only use when format == 'html'
                    callback = options.callback;
                    // view render is async model
                    this.__async__ = true;
                    res.render(view, data, callback || function(err, html) {
                        if (!err) {
                            res.write(html);
                        }
                        options.next ? options.next() : res.end();
                    });
                } else {
                    res.write(data);
                }
            } else {
                if (format != 'jsonp') {
                    res.json(data);
                } else {
                    res.jsonp(data);
                }
            }
        },
        // async run modules code
        // if use run method, all code must wrap use this method
        icRun: function(item) {
            var self = this,
                stack = this.__syncStack__,
                parallelCallbacks;

            this.__async__ = true;
            if (arguments.length <= 0) {
                return;
            } else if (arguments.length == 1) {
                stack.push(function() {
                    item.apply(self, arguments);
                });
            } else {
                parallelCallbacks = [].slice.call(arguments, 0);
                stack.push(function(req, res, next) {
                    async.forEach(parallelCallbacks, function(fn, done) {
                        fn.call(self, req, res, done);
                    }, next);
                });
            }
        },
        _getType: function(type) {
            return~type.indexOf('/') ? type : express.mime.lookup(type);
        },
        _runQueue: function() {
            var self = this,
                type = this._getType(this.get('defaultFormat')),
                stack = this.__syncStack__,
                args = this.__actionargs__,
                req = args[0],
                res = args[1];

            if (this.__async__ && stack.length) {
                // write header for bigpipe 
                if (!res.headersSent) {
                    res.writeHead(200, {
                        'Content-Type': type + '; charset=' + res.charset
                    });
                }
                async.eachSeries(stack, function(item, next) {
                    item.call(self, req, res, next);
                }, function(err) {
                    // run error
                    if (err) {
                        icFrame.logger.log(err);
                    }
                    res.end();
                });
            } else if (!res.__isEnded__) {
                // auto end() call
                res.end();
            }
        }
    });

    return instance;
};