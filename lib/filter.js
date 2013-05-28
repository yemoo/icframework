var fs = require('fs'),
    path = require('path'),
    utils = require('utilities'),
    mixFilter = {
        init: function () {
            var filter = icFrame.configUtil.loadConfig({}, 'filter');

            this.before = Object.keys(filter.before).length ? filter.before : false;
            this.after = Object.keys(filter.after).length ? filter.after : false;
        },
        getActionFilter: function (instance, action) {
            var disabled = instance['_DISABLED_FILTERS'],
                beforeDisabled = [],
                afterDisabled = [],
                before = this.before,
                after = this.after,
                _before, _after;

            var parseConfig = function (item) {
                if (!item) return;
                if (Array.isArray(item)) {
                    beforeDisabled = beforeDisabled.concat(item);
                    afterDisabled = afterDisabled.concat(item);
                } else {
                    if (item['before']) {
                        beforeDisabled = beforeDisabled.concat(item['before']);
                    }
                    if (item['after']) {
                        afterDisabled = afterDisabled.concat(item['after']);
                    }
                }
            };

            if ((before || after) && disabled) {
                // for all action
                parseConfig(disabled['*']);
                // current action
                parseConfig(disabled[action]);

                if (beforeDisabled.length && before) {
                    _before = {};
                    Object.keys(before).forEach(function (key) {
                        if (!~beforeDisabled.indexOf(key)) {
                            _before[key] = before[key];
                        }
                    });
                }
                if (afterDisabled.length && after) {
                    _after = {};
                    Object.keys(after).forEach(function (key) {
                        if (!~afterDisabled.indexOf(key)) {
                            _after[key] = after[key];
                        }
                    });
                }
            }

            return {
                before: _before || before,
                after: _after || after
            };
        }
    };

mixFilter.init();
module.exports = mixFilter;