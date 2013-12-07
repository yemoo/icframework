// ERROR_MESSAGE
var utils = icFrame.utils;

module.exports = function(req, res, next) {
    var message = [];
    // 验证函数
    req.validate = function(validators, mapped) {
        var errors;

        validators.call(this);

        errors = req.validationErrors(mapped);
        if (errors) {
            req.ctrlUtil.render({
                err_no: -101,
                err_msg: message,
                results: errors
            });
        }
        return !errors;
    };

    // 捕获错误
    req.onValidationError(function(msg) {
        message.push(msg);
    });
    next();
};