var util = require('util'),
    logger = icFrame.logger.getLogger('gearman'),
    LOG_REQ = 1, // 输出请求日志
    LOG_RES = 2, // 输入响应日志
    LOG_FULL_REQ = 4, // 输出完整的请求日志 
    LOG_FULL_RES = 8, // 输出完整的响应日志
    submitJob = icFrame.gearman.submitJob.bind(icFrame.gearman),
    logconfig = {
        depth: null
    };

// 扩展submitJob
module.exports = function(fname, request, options) {
    var req = this,
        ctrlUtil = req.ctrlUtil,
        start = Date.now(),
        uid = req.session.uid || '',
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
                        logger.info(['job-res', /*(new Date).toISOString(),*/ req.ip, 'uid:' + uid, jobName, util.inspect(data, showFullResLog && logconfig).replace(/[\n\r\s]+/g, ' '), (Date.now() - start) + 'ms'].join(' | '));
                    });
                }

                callback.call(this, data.response);
            }
        };

    if (arguments.length < 1) {
        return false;
    }
    _request.c && jobName.push(_request.c);
    _request.m && jobName.push(_request.m);
    jobName = jobName.join('.');

    request = {
        header: {
            version: "1",
            signid: '' + icFrame.utils.string.uuid(10, 10),
            provider: '' + (_request.provider || ''),
            uid: '' + uid || '1',
            uname: '' + (req.session.uname || ''),
            token: '' + (req.session.token || ''),
            auth: 'sso',
            ip: '' + icFrame.config.ipAddressNum,
            mold: _request.mold || '',
            appid: _request.appid || '0',
        },
        request: _request
    };
    delete _request.LOG;
    delete _request.mold;
    delete _request.provider;

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
            logger.info(['job-req', /*(new Date).toISOString(),*/ req.ip, 'uid:' + uid, jobName, util.inspect(request, showFullReqLog && logconfig).replace(/[\n\r\s]+/g, ' ')].join(' | '));
        });
    }

    return submitJob(fname, request, options);
};