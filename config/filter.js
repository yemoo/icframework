var printf = require('printf');

function getLogId() {
    var t = new Date();
    return printf('%u', (((t.getUTCSeconds() * 100000 + t.getUTCMilliseconds() * 1000 / 10) & 0x7FFFFFFF) | 0x80000000));
}

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

module.exports = {
    before: {
        GEARMAM_INTERFACE: function(req, res) {
            var instance = this,
                submitJob = icFrame.submitJob;

            icFrame.submitJob = function(fname, data, options) {
                var args = [].slice.call(arguments, 0),
                    provider = '',
                    params = data || '';

                if (typeof data == 'object' && data.params) {
                    params = data.params;
                    provider = data.provider || '';
                }

                args[1] = {
                    header: {
                        version: 1,
                        signid: getLogId(),
                        provider: provider,
                        // TODO: integrate passport
                        uid: '',
                        uname: '',
                        ip: icFrame.config.ipAddress
                    },
                    request: {
                        c: instance.get('controller'),
                        m: instance.get('action'),
                        p: params
                    }
                };

                if (typeof options == 'function') {
                    args[2] = wrapCallback(options);
                } else if (typeof options == 'object' && options.callback) {
                    args[2].callback = wrapCallback(options.callback);
                }

                return submitJob.apply(icFrame, args);
            };
        }
    },
    after: {}
}