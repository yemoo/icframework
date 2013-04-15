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
            var ctrlUtil = req.__ctrlUtil__;

            if (!icFrame.__submitJob) {
                icFrame.__submitJob = icFrame.submitJob;
            }
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
                } else if (typeof options == 'object' && options.callback) {
                    args[2].callback = wrapCallback(options.callback);
                }

                // set model is async
                ctrlUtil.set('async', true);
                return icFrame.__submitJob.apply(icFrame, args);
            };
        },
        // shortcut for controller log
        'CTRL_LOGGER': function(req, res) {
            this.logger = icFrame.logger;
        }
    },
    after: {}
}