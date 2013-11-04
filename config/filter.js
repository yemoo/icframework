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
        // json/jsonp模式下重写res.redirect
        'REDIRECT': function(req, res, next) {
            var redirect = res.redirect;
            res.redirect = function(url) {
                var args = arguments,
                    mineType = res.mimeType,
                    status = 302;

                if (mineType == 'json' || mineType == 'jsonp') {
                    var status = 302;
                    if (2 == args.length) {
                        if ('number' == typeof url) {
                            status = url;
                            url = args[1];
                        } else {
                            status = args[1];
                        }
                    }
                    res[mineType](req.wrapperError('REDIRECT', {
                        url: url,
                        status: status
                    }));
                } else {
                    redirect.apply(res, args);
                }
            };
            next();
        }
    },
    after: {}
};