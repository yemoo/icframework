/* global icFrame */
var utils = icFrame.utils,
    mime = require('express').mime,
    validator = require('express-validator/node_modules/validator');

// 默认参数
var defaultProp = {
    __valid__: true,

    __req__: null,
    __res__: null,
    __instance__: null,

    __view__: '',
    __filepath__: '',
    __controller__: '',
    __action__: 'index',

    __syncStack__: []
};

function ctrlUtil(prop) {
    utils.mixin(this, defaultProp, prop);
}

utils.mixin(ctrlUtil.prototype, {
    is: function(name) {
        return !!this.get(name);
    },
    set: function(name, value) {
        var method = '_set',
            args;

        method += utils.string.camelize(name, {
            initialCap: true
        });

        if (this[method]) {
            args = [].slice.call(arguments, 1);
            return this[method].apply(this, args);
        } else {
            this['__' + name + '__'] = value;
            return this;
        }
    },
    // set view for instance action
    _setView: function(view) {
        this.__view__ = this._getViewPath(view);
        return this;
    },
    // get 
    get: function(name) {
        return this['__' + name + '__'];
    },
    _getViewPath: function(view) {
        return view ? icFrame.APP._getViewPath({
            view: view
        }) : false;
    },
    _getContentType: function() {
        var res = this.get('res'),
            type = res.get('Content-Type');

        if (!type) {
            type = mime.lookup(res.mimeType);
            type = (~type.indexOf('/')) ? type : mime.lookup(type);
            type += '; charset=' + res.charset;
        }
        return type;
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
                }, fn;

            // if request has aborted, stop processing queue
            if (!self.is('valid')) {
                icFrame.logger.getLogger().warn('the request ' + self.get('filepath') + '.' + self.get('action') + ' was aborted!');
                stack.length = 0;
            }

            if (err) {
                req.next(err);
                stack.length = 0;
            }

            if (stack.length) {
                fn = stack.shift();
                fn.call(instance, req, res, next);
            }
        })();

    },
    renderView: function(view, data, callback) {
        this.get('res').render(view, data, callback);
    },
    // if use this method(means sync method, this will support autotype(html, json, jsonp) response), you will not able to use icRun method!
    // [options] two ways:
    //   -- viewpath string "xxx/xxx.html"
    //   -- {format:'html',view: '', callback: function(){...}}, {format:'json'}
    render: function(data, options, callback) {
        var res = this.get('res'),
            isType = utils.frame.isType,
            format = res.mimeType,
            view;

        data = data || '';

        if (options === undefined || options === null) {
            options = {};
        }

        // 文档类型
        if (isType(options.format, 'string')) {
            format = options.format;
        }

        // data为函数
        if (isType(data, 'function')) {
            data = data();
        }

        // 字符串
        if (isType(data, 'string')) {
            res.send(data);
        }

        // options: undefined, {}, {type:'html'}
        if (format === 'html') {
            view = isType(options, 'string') ? options : options.view;
            view = view && this._getViewPath(view) || this.get('view');
            if (view) {
                // callback only use when format == 'html'
                this.renderView(view, data, callback || options.callback);
            } else {
                res.send(data);
            }
        } else {
            if (format !== 'jsonp') {
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

        if (arguments.length === 1) {
            stack.push(item);
        } else if (arguments.length > 1) {
            parallelCallbacks = [].slice.call(arguments, 0);
            stack.push(function(req, res, next) {
                var total = parallelCallbacks.length,
                    cur = 0,
                    done = function(err) {
                        if (err) {
                            next(err);
                        } else {
                            if (++cur === total) {
                                next();
                            }
                        }
                    };
                parallelCallbacks.forEach(function(fn) {
                    if (typeof fn != 'function') done();
                    fn.call(instance, req, res, done);
                });
            });
        }
    }
});

module.exports = ctrlUtil;