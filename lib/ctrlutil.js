var utils = require('utilities'),
    express = require('express');

module.exports = function() {
    return {
        __valid__: true,

        __req__: null,
        __res__: null,
        __instance__: null,

        __view__: '',
        __action__: 'index',
        __controller__: '',
        __syncStack__: [],
        __async__: false,
        is: function(name) {
            return !!this.get(name);
        },
        // get 
        get: function(name) {
            return this['__' + name + '__'];
        },
        set: function(name, value) {
            var args, method = '__set' + utils.string.camelize(name, {
                initialCap: true
            });

            if (this[method]) {
                args = [].slice.call(arguments, 1);
                return this[method].apply(this, args);
            } else {
                return this['__' + name + '__'] = value;
            }
        },
        // set view for instance action
        __setView: function(view) {
            return this.__view__ = icFrame.APP._getViewPath({
                view: view
            });
        },
        __getContentType: function(type) {
            type = (~type.indexOf('/')) ? type : express.mime.lookup(type);
            return type + '; charset=' + this.get('res').charset
        },
        __writeHead: function() {
            var res = this.get('res');
            if (!res.headersSent) {
                res.writeHead(200, {
                    'Content-Type': this.__getContentType(res.mimeType)
                });
            }
        },
        runQueue: function() {
            var self = this,
                instance = self.get('instance'),
                stack = self.get('syncStack'),
                req = self.get('req'),
                res = self.get('res');

            if (self.is('async')) {
                // write header for async model
                self.__writeHead();
                if (stack.length) {
                    // sync queue process
                    var total = stack.length,
                        cur = 0,
                        next = function(err) {
                            var errorMsg;
                            // if request has aborted, stop processing queue
                            if (!self.is('valid')) {
                                errorMsg = 'the request ' + self.get('controller') + '.' + self.get('action') + ' was aborted!';
                                err = new Error(errorMsg);
                            }
                            if (err) {
                                icFrame.logger.warn(err);
                            }

                            if (err || (cur >= total)) {
                                res.end();
                            } else {
                                stack[cur++].call(instance, req, res, next);
                            }
                        };

                    next();
                }
            } else {
                // if not async, auto call end()
                res.end();
            }
        },
        // if use this method(means sync method, this will support autotype(html, json, jsonp) response), you will not able to use icRun method!
        // [options] two ways:
        //   -- 'html', 'json', 'jsonp'
        //   -- {format:'html',view: '', callback: function(){...}}, {format:'json'}
        render: function(data, options, next) {
            var view = this.get('view'),
                res = this.get('res'),
                format = res.mimeType,
                callback;

            if (options) {
                if (typeof options == 'string') {
                    format = options;
                    options = {};
                } else {
                    // options.format override the defaultFormat
                    format = options.format || format;
                }
            } else {
                options = {};
            }
            // options: undefined, {}, {type:'html'}
            if (format == 'html') {
                view = options.view || view; //options.view ? this.set('view', options.view) : view;
                if (view) {
                    // callback only use when format == 'html'
                    callback = options.callback;
                    // view render is async model
                    this.set('async', true);
                    res.render(view, data, callback || function(err, html) {
                        if (!err) {
                            res.write(html);
                        }
                        next ? next() : res.end();
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
        run: function(item) {
            var instance = this.get('instance'),
                stack = this.get('syncStack'),
                parallelCallbacks;

            this.set('async', true);
            if (arguments.length <= 0) {
                return;
            } else if (arguments.length == 1) {
                stack.push(function() {
                    item.apply(instance, arguments);
                });
            } else {
                parallelCallbacks = [].slice.call(arguments, 0);
                stack.push(function(req, res, next) {
                    var total = parallelCallbacks.length,
                        cur = 0,
                        done = function(err) {
                            if (err) {
                                next(err);
                            } else {
                                if (++cur == total) {
                                    next();
                                }
                            }
                        };
                    parallelCallbacks.forEach(function(fn) {
                        fn.call(instance, req, res, done);
                    });
                });
            }
        }
    }
};