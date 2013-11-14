var util = require('util'),
    utils = icFrame.utils,
    logger = icFrame.logger.getLogger('gearman'),
    pid = process.pid,
    env = icFrame.config.env,
    defUID = env == 'production' ? '' : '1',
    LOG_REQ = 1, // 输出请求日志
    LOG_RES = 2, // 输入响应日志
    LOG_FULL_REQ = 4, // 输出完整的请求日志 
    LOG_FULL_RES = 8, // 输出完整的响应日志
    submitJob = icFrame.gearman.submitJob.bind(icFrame.gearman),
    logconfig = {
        depth: null
    };

// 扩展submitJob

function _submitJob(fname, request, options) {
    var req = this,
        ctrlUtil = req.ctrlUtil,
        start = Date.now(),
        uid = req.session.uid || defUID,
        // gearman header配置
        gmHeader = icFrame.config.gearman.header || {},
        _request = request || {},
        logtype = typeof _request.LOG === 'undefined' ? 3 : _request.LOG, // 默认输出请求和响应日志
        showFullReqLog = (logtype & LOG_FULL_REQ) == LOG_FULL_REQ,
        showFullResLog = (logtype & LOG_FULL_RES) == LOG_FULL_RES,
        showReqLog = showFullReqLog || (logtype & LOG_REQ) == LOG_REQ,
        showResLog = showFullResLog || (logtype & LOG_RES) == LOG_RES,
        jobName = [fname],
        wrapCallback = function(callback) {
            return function(data) {
                // 格式化data
                if (!data.hasOwnProperty('response') && !data.hasOwnProperty('header')) {
                    data = {
                        response: data,
                        header: request.header || {}
                    };
                } else {
                    !data.hasOwnProperty('response') && (data.response = {});
                    !data.hasOwnProperty('header') && (data.header = request.header || {});
                }

                if (showResLog) {
                    process.nextTick(function() {
                        logger.info(['job-res', 'pid:' + pid, /*(new Date).toISOString(),*/ req.ip, 'uid:' + uid, jobName, util.inspect(data, showFullResLog && logconfig).replace(/[\n\r\s]+/g, ' '), (Date.now() - start) + 'ms'].join(' | '));
                    });
                }

                callback.call(this, data.response);
            }
        }, header;

    if (arguments.length < 1) {
        return false;
    }
    _request.c && jobName.push(_request.c);
    _request.m && jobName.push(_request.m);
    jobName = jobName.join('.');

    // 兼容之前的代码 [header配置以后都写到HEADER中]
    !_request.HEADER && (_request.HEADER = {});
    if(_request.provider){
        _request.HEADER.provider = _request.provider;
    }
    if(_request.mold){
        _request.HEADER.mold = _request.mold;
    }
    // End 兼容代码

    header = utils.mixin({
        version: 1,
        signid: utils.string.uuid(10, 10),
        uid: uid,
        uname: req.session.uname || '',
        token: req.session.token || '',
        ip: icFrame.config.ipAddressNum,
        auth: 'sso',
        provider: '',
        mold: '',
    }, gmHeader, _request.HEADER);

    // 强制所有header val为字符串
    Object.keys(header).forEach(function(key) {
        header[key] = '' + header[key];
    });
    request = {
        header: header,
        request: _request
    };
    delete _request.LOG;
    delete _request.HEADER;

    if (options === true) {
        options = wrapCallback(function(job) {
            ctrlUtil.render(job);
        });
    } else if (typeof options == 'function') {
        options = wrapCallback(options);
    } else if (typeof options == 'object' && options.callback) {
        options.callback = wrapCallback(options.callback);
    }

    if (showReqLog) {
        process.nextTick(function() {
            logger.info(['job-req', 'pid:' + pid, /*(new Date).toISOString(),*/ req.ip, 'uid:' + uid, jobName, util.inspect(request, showFullReqLog && logconfig).replace(/[\n\r\s]+/g, ' ')].join(' | '));
        });
    }

    return submitJob(fname, request, options);
};

module.exports = function(req, res, next) {
    req.submitJob = _submitJob;
    next();
};