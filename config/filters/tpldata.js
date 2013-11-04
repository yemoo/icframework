var reqKeys = ['params', 'query', 'body', 'cookies', 'signedCookies',
    'ip', 'ips', 'protocol', 'domain', 'path', /*'host', */ 'xhr', 'url', 'originalUrl', 'method', 'originalMethod',
    'session', 'headers', 'httpVersion'
];

module.exports = function(req, res, next) {
    var locals = this._LOCALS,
        reqData = {};

    // 全局级别的data
    reqKeys.forEach(function(key) {
        reqData[key] = req[key];
    });
    res.locals.req = reqData;

    // controller级别的data
    if (typeof locals === 'object') {
        Object.keys(locals).forEach(function(key) {
            res.locals[key] = locals[key];
        });
    }

    // 增加模版数据的快捷操作
    res.addTplData = function(key, value) {
        if (typeof key === 'object') {
            Object.keys(key).forEach(function(name) {
                res.locals[name] = key[name];
            });
        } else {
            res.locals[key] = value;
        }
    };
    next();
};