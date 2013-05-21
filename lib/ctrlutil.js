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
        // for chunked output (bigpipe)
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
        _getContentType: function() {
            var res = this.get('res');
            if (res.get('Content-Type')) return res.get('Content-Type');
            type = express.mime.lookup(res.mimeType);
            type = (~type.indexOf('/')) ? type : express.mime.lookup(type);
            return type + '; charset=' + res.charset;
        },
        _writeHead: function() {
            var res = this.get('res');
            // only use for bigpipe
            if (!res.headersSent) {
                res.writeHead(200, {
                    'Content-Type': this._getContentType()
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

            // sync queue process
            (function(err) {
                var callee = arguments.callee,
                    next = function() {
                        if (!next.called) {
                            next.called = true;
                            callee.apply(this, arguments);
                        }
                    }, errorMsg, fn;

                // if request has aborted, stop processing queue
                if (!self.is('valid')) {
                    icFrame.logger.log('the request ' + self.get('filepath') + '.' + self.get('action') + ' was aborted!');
                    stack.length = 0;
                }

                if (err) {
                    req.next(err);
                    stack.length = 0;
                }

                if (stack.length) {
                    fn = stack.shift();
                    // console.log(stack.length + ', ' + fn.NAME + ', complete.....');
                    fn.call(instance, req, res, next);
                } else {
                    !self.is('async') && !self.is('chunked') && !res.isEnded && res.end();
                }
            })();

        },
        renderView: function(view, data, callback) {
            this.get('res').render(view, data, callback);
        },
        // if use this method(means sync method, this will support autotype(html, json, jsonp) response), you will not able to use icRun method!
        // [options] two ways:
        //   -- 'html', 'json', 'jsonp'
        //   -- {format:'html',view: '', callback: function(){...}}, {format:'json'}
        render: function(data, options, callback) {
            var res = this.get('res'),
                format = res.mimeType,
                view;

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
                    this.renderView(view, data, callback || options.callback);
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
        // chunked run modules code
        // if use run method, all code must wrap use this method
        run: function(item) {
            var instance = this.get('instance'),
                stack = this.get('syncStack'),
                parallelCallbacks;

            this.set('chunked', true);
            if (arguments.length <= 0) {

            } else if (arguments.length == 1) {
                stack.push(item);
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