var utils = require('utilities'),
    express = require('express'),
    validator = require('express-validator/node_modules/validator');

module.exports = function() {
    return {
        __valid__: true,

        __req__: null,
        __res__: null,
        __instance__: null,

        __view__: '',
        __filepath__: '',
        __controller__: '',
        __action__: 'index',

        __syncStack__: [],
        // for trunked output (bigpipe)
        __chunked__: false,
        // for async model
        __async__: false,
        is: function(name) {
            return !!this.get(name);
        },
        // get 
        get: function(name) {
            return this['__' + name + '__'];
        },
        set: function(name, value) {
            var args, method = '_set' + utils.string.camelize(name, {
                initialCap: true
            });

            if (this[method]) {
                args = [].slice.call(arguments, 1);
                return this[method].apply(this, args);
            } else {
                return this['__' + name + '__'] = value;
            }
        },
        _getViewPath: function(view) {
            return view ? icFrame.APP._getViewPath({
                view: view
            }) : false;
        },
        // set view for instance action
        _setView: function(view) {
            return this.set('view', this._getViewPath(view));
        },
        _getContentType: function(type) {
            type = (~type.indexOf('/')) ? type : express.mime.lookup(type);
            return type + '; charset=' + this.get('res').charset
        },
        _writeHead: function() {
            var res = this.get('res');
            if (!res.headersSent) {
                res.writeHead(200, {
                    'Content-Type': this._getContentType(res.mimeType)
                });
            }
        },
        validator: validator,
        check: validator.check,
        sanitize: validator.sanitize,
        runQueue: function() {
            var self = this,
                instance = self.get('instance'),
                stack = self.get('syncStack'),
                req = self.get('req'),
                res = self.get('res');

            if (self.is('chunked')) {
                // write header for chunked model
                self._writeHead();
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
            } else if (!self.is('async')) {
                // if not async, auto call end()
                res.end();
            }
        },
        // if use this method(means sync method, this will support autotype(html, json, jsonp) response), you will not able to use icRun method!
        // [options] two ways:
        //   -- 'html', 'json', 'jsonp'
        //   -- {format:'html',view: '', callback: function(){...}}, {format:'json'}
        render: function(data, options, next) {
            var res = this.get('res'),
                format = res.mimeType,
                view, callback;

            data = data || '';
            if (typeof data == 'function') {
                data = data();
            }
            if (typeof data != 'string' && typeof data != 'object') {
                data = String(data);
            }

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
                view = this._getViewPath(options.view) || this.get('view'); //options.view ? this.set('view', options.view) : view;
                if (view) {
                    // callback only use when format == 'html'
                    callback = options.callback;
                    res.render(view, data, callback || function(err, html) {
                        if (!err) {
                            res.write(html);
                        }else{
                            res.write(String(err));
                        }
                        next ? next() : res.end();
                    });
                } else {
                    res.send(data);
                }
            } else {
                if (format != 'jsonp') {
                    res.json(data);
                } else {
                    res.jsonp(data);
                }
            }
        },
        // trunked run modules code
        // if use run method, all code must wrap use this method
        run: function(item) {
            var instance = this.get('instance'),
                stack = this.get('syncStack'),
                parallelCallbacks;

            this.set('trunked', true);
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