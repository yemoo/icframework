// config before/after filter functions
// just like write controller.action
var reqKeys = ['params', 'query', 'body', 'cookies', 'signedCookies',
    'ip', 'ips', 'protocol', 'domain', 'path', 'host', 'xhr', 'url', 'originalUrl', 'method', 'originalMethod',
    'session', 'headers', 'httpVersion'];

module.exports = {
    before: {
        // for controller level template variables
        'TPL_DATA': function(req, res) {
            var locals = this._LOCALS,
                reqData = {};

            reqKeys.forEach(function(key) {
                reqData[key] = req[key];
            });
            res.locals['req'] = reqData;

            if (typeof locals == 'object') {
                Object.keys(locals).forEach(function(key) {
                    res.locals[key] = locals[key];
                });
            }

        }
    },
    after: {}
}