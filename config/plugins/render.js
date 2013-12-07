var utils = icFrame.utils,
    domain = icFrame.config.view.data.domain || '',
    ctrlUtil = icFrame.require('./ctrlutil'),
    render = ctrlUtil.prototype.render,
    renderView = ctrlUtil.prototype.renderView,
    loginUrl = icFrame.config.loginUrl || '/login',
    defaultMsg = '未知错误',
    defaultData = {
        err_no: 0,
        err_msg: '',
        results: {}
    };

loginUrl += loginUrl.indexOf('?') == -1 ? '?' : '&';

// 重写render和renderView实现，处理服务端错误 

// 渲染模板输出
ctrlUtil.prototype.renderView = function(view, data) {
    var req = this.get('req'),
        res = this.get('res');

    // 输出错误信息到页面，不渲染模板
    if (data.err_no != 0) {
        // 重新登录
        if (data.err_no == '302') {
            this.sessionDestroy();
            return;
        }
        // gearman请求出错
        if (!data.IGNORE_ERR) {
            // 抛出错误
            req.next(new Error(data.err_msg || defaultMsg));
            return;
        }
    }
    return renderView.apply(this, arguments);
};

// 数据格式化
ctrlUtil.prototype.render = function(data, options, callback) {
    render.call(this, utils.mixin({}, defaultData, data), options, callback);
}

ctrlUtil.prototype.sessionDestroy = function() {
    var req = this.get('req'),
        res = this.get('res');

    req.session.destroy();
    res.redirect(loginUrl + 'referer=' + encodeURIComponent(req.originalUrl));
}

module.exports = function(req, res, next) {
    next();
};