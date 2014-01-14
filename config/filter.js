// filter：只在匹配到url回调的情况下执行，设计到路径拦截解析的最好放到plugin中
// 可配置在callback之前或者之后执行
// 和编写controller.action完全一样

module.exports = {
    before: {
        // for controller level template variables
        'TPL_DATA': function(req, res, next) {
            require('./filters/tpldata.js').apply(this, arguments);
            next();
        },
        'REQUEST_FORMAT': function(req, res, next) {
            var supportFormat = ['html', 'json', 'jsonp'],
                format = req.param('format');

            if (format && ~supportFormat.indexOf(format)) {
                res.mimeType = format;
            }
            next();
        },
        'VALIDATOR': function(req, res, next) {
            require('./filters/validator.js').apply(this, arguments);
            next();
        },
        // ajax模式下重写res.redirect
        'REDIRECT': function(req, res, next) {
            var end = res.end;
            res.end = function() {
                var location = this.get('Location');

                if (req.xhr && location) {
                    this.removeHeader('Location');
                    this.removeHeader('Content-Length');
                    this[this.mimeType === 'jsonp' ? 'jsonp' : 'json'](200, {
                        err_no: this.statusCode,
                        err_msg: 'REDIRECT',
                        results: location
                    });
                } else {
                    end.apply(this, arguments);
                }
            };
            next();
        }
    },
    after: {}
};