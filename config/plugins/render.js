var utils = icFrame.utils,
    domain = icFrame.config.view.data.domain || '',
    ctrlUtil = icFrame.require('./ctrlutil'),
    render = ctrlUtil.prototype.render,
    renderView = ctrlUtil.prototype.renderView,
    loginConfig = icFrame.config.loginConfig,
    defaultLoginConfig = {
        url: '/login', // 登陆页url
        referer: 'referer', // 参数名
        refererDomain: '' // 强制跳转在某个域名下，安全考虑，此处并不能完全解决，需要login中对referer的值进行过滤再跳转
    },
    defaultMsg = '未知错误',
    defaultData = {
        err_no: 0,
        err_msg: '',
        results: {}
    };

// loginConfig格式检查
loginConfig = utils.frame.isType(loginConfig, 'object') ? utils.mixin({}, defaultLoginConfig, loginConfig) : defaultLoginConfig;

// 重写render和renderView实现，处理服务端错误 
ctrlUtil.prototype.renderView = function(view, data) {
    var req = this.get('req'),
        res = this.get('res'),
        errorCallback;

    // 输出错误信息到页面，不渲染模板
    if (data.err_no != 0) {
        // 重新登录
        if (data.err_no == '302') {
            this.sessionDestroy();
            return;
        }

        if (!data.err_msg) {
            data.err_msg = defaultMsg;
        };

        // gearman请求出错
        if (!data.IGNORE_ERR) {
            errorCallback = req.onRenderViewError || this.onRenderViewError;
            // 默认的模板错误
            if (!errorCallback) {
                // 应用返回的错误，暂时直接输出到页面上
                // TODO: 错误处理的约定及输出方式的优化
                res.send(data.err_msg);
                // res.next(new Error(data.err_msg));
            } else {
                errorCallback.apply(this, arguments);
            }
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
        res = this.get('res'),
        locals = req.app.locals,
        url = loginConfig.url;

    // 支持 {xxx} 实现自动采用模板变量替换
    function replaceRe(str) {
        return str.replace(/\{(\w+)\}/g, function(o, name) {
            return locals[name] || name;
        })
    }

    // 有param参数配置则自动加referer参数，否则不加
    if (loginConfig.referer) {
        url += url.indexOf('?') == -1 ? '?' : '&';
        url = url.replace(new RegExp(loginConfig.referer + '=[^&]*', 'g'), '');
        url += loginConfig.referer + '=' + encodeURIComponent(replaceRe(loginConfig.refererDomain + req.originalUrl));
    }

    req.session.destroy();
    res.redirect(url);
}

module.exports = function(req, res, next) {
    next();
};