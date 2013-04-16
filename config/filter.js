//var emitter = require('events').EventEmitter;  // [CACHE SUPPORT]

function wrapCallback(callback) {
    return function(job) {
        var payload = job.payload;
        // add short for job results
        if (payload.response) {
            job.response = payload.response;
            if (job.response.results) {
                job.results = job.response.results;
            };
        };

        callback.apply(this, arguments);
    };
}

/*
// [CACHE SUPPORT START]
var stringify = function(data) {
    if (!data) {
        return data === null || data === undefined ? '' : data;
    } else if (typeof data == 'string') {
        return data;
    } else if (typeof data == 'object') {
        return JSON.stringify(data);
    }
};

if (!icFrame.cacheQueue) {
    icFrame.cacheQueue = {};
    icFrame.eventQueue = new emitter();
    icFrame.eventQueue.setMaxListeners(0);
}
// [CACHE SUPPORT END]
*/


module.exports = {
    before: {
        GEARMAM_INTERFACE: function(req, res) {
            var ctrlUtil = req.__ctrlUtil__;

            if (!icFrame.__submitJob) {
                icFrame.__submitJob = icFrame.submitJob;
            }
            icFrame.submitJob = function(fname, data, options) {
                var args = [].slice.call(arguments, 0),
                    // [CACHE SUPPORT START]
                    //callback = function() {},
                    //_callback,
                    // [CACHE SUPPORT END]
                    provider = '',
                    params = data || '';

                if (typeof data == 'object' && data.params) {
                    params = data.params;
                    provider = data.provider || '';
                }

                args[1] = {
                    header: {
                        version: 1,
                        signid: req.sign_id,
                        provider: provider,
                        // TODO: integrate passport
                        uid: '',
                        uname: '',
                        ip: icFrame.config.ipAddressNum
                    },
                    request: {
                        c: ctrlUtil.get('controller'),
                        m: ctrlUtil.get('action'),
                        p: params
                    }
                };
                if (typeof options == 'function') {
                    args[2] = wrapCallback(options);
                    // [CACHE SUPPORT START]
                    //callback = wrapCallback(options);
                    //options = null;
                    // [CACHE SUPPORT END]
                } else if (typeof options == 'object' && options.callback) {
                    args[2].callback = wrapCallback(options.callback);
                    // [CACHE SUPPORT START]
                    //callback = wrapCallback(options.callback);
                    //delete options.callback;
                    // [CACHE SUPPORT END]
                }


                /* 
                // [CACHE SUPPORT START]
                // every cacheName run once
                var cacheName = fname + stringify(params) + provider + stringify(options);
                icFrame.eventQueue.once(cacheName, function(args) {
                    //console.log('loaded');
                    callback.apply(this, args);
                });

                console.log(icFrame.cacheQueue)
                if (!icFrame.cacheQueue[cacheName]) {
                    console.log(cacheName);
                    icFrame.cacheQueue[cacheName] = true;

                    _callback = function() {
                        delete icFrame.cacheQueue[cacheName];
                        icFrame.eventQueue.emit(cacheName, arguments);
                    };
                    if (options === null) {
                        args[2] = _callback;
                    } else if (typeof options == 'object') {
                        args[2].callback = _callback;
                    }
                // [CACHE SUPPORT END]
                */

                // set model is async
                ctrlUtil.set('async', true);
                return icFrame.__submitJob.apply(icFrame, args);

                // [CACHE SUPPORT START]
                //}
                // [CACHE SUPPORT END]
            };
        },
        // shortcut for controller log
        'CTRL_LOGGER': function(req, res) {
            this.__logger = icFrame.logger;
        }
    },
    after: {}
}