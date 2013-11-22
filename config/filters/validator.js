// ERROR_MESSAGE
var defaultError = {
    err_no: -5,
    err_msg: '未知错误'
}, TYPE_MAP = {
        'VALIDATOR': {
            err_no: -101,
            err_msg: '表单验证失败'
        },
        'REDIRECT': {
            // 页面跳转 err_no = 0， 因为不属于错误
            err_no: 0,
            err_msg: '页面跳转'
        },
        'METHOD': {
            err_no: -2,
            err_msg: '不正确的数据提交方式'
        },
        'TIMEOUT': {
            err_no: -1,
            err_msg: '服务处理超时'
        }
    }, utils = icFrame.utils;

module.exports = function(req, res, next) {
    req.wrapperError = function(type, results, obj) {
        var error = utils.mixin({}, TYPE_MAP[type] || defaultError);
        error.results = results || '';
        return utils.mixin(error, obj);
    };

    req.getValidationErrors = function(mapped, msg) {
        var errors = req.validationErrors(mapped);
        if (errors) {
            if (msg != undefined) {
                if (typeof msg == 'number' && errors[msg]) {
                    msg = {
                        err_msg: errors[msg].msg
                    };
                }
                if (typeof msg != 'object') {
                    msg = {
                        err_msg: String(msg)
                    };
                }
            }
            return req.wrapperError('VALIDATOR', errors, msg);
        }
        return errors;
    }

    req.invalidMethodError = function(method, results, obj) {
        return (req.method.toLowerCase() != method.toLowerCase()) && req.wrapperError('METHOD', results, obj);
    }
    req.validMethodError = function(method, results, obj) {
        return (req.method.toLowerCase() == method.toLowerCase()) ? false : req.wrapperError('METHOD', results, obj);
    }

    req.checkValue = function(value, fail_msg) {
        validator = new req.ctrlUtil.validator.Validator();
        validator.error = function(msg) {
            var error = {
                msg: msg,
                value: value
            };
            if (req._validationErrors === undefined) {
                req._validationErrors = [];
            }
            req._validationErrors.push(error);

            if (req.onErrorCallback) {
                req.onErrorCallback(msg);
            }
            return this;
        }
        return validator.check(value, fail_msg);
    }
    next();
};
