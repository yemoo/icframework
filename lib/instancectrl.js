var utils = require('utilities'),
	async = require('async');

module.exports = function(controller) {
	if (!controller) return controller;

	var instance = new controller();

	utils.mixin(instance, {
		__actionargs__: [],
		__view__: '',
		__syncStack__: [],
		__async__: false,
		// if use this method(means sync method, this will support autotype(html, json, jsonp) response), you will not able to use run method!
		icRender: function(data, options) {
			var view = this.__view__,
				args = this.__actionargs__;

			this.__async__ = true;
			(function(req, res, next) {
				// options: undefined, {}, {type:'html'}
				if (view && (!options || !options.format || options.format == 'html')) {
					res.render(view, data, (options && options.callback) || function(err, html) {
						if (!err) {
							res.write(html);
							res.end();
						}
					});
				} else {
					if (!options || !options.format || options.format != 'jsonp') {
						res.json(data);
					} else {
						res.jsonp(data);
					}
				}
			}).apply(this, args);
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
		_runQueue: function() {
			var self = this,
				stack = this.__syncStack__,
				args = this.__actionargs__;

			(function(req, res, next) {
				if (self.__async__) {
					if (stack.length) {
						async.eachSeries(stack, function(item, next) {
							item.call(self, req, res, next);
						}, function(err) {
							// run error
							if (err) {
								icFrame.logger.log(err);
							}
							res.end();
						});
					}
				} else if (!res.__isEnded__) {
					// auto end() call
					res.end();
				}
			}).apply(self, args);
		}
	});

	return instance;
};