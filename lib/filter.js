var fs = require('fs'),
    path = require('path'),
    utils = require('utilities'),
    mixFilter = {
        init: function() {
            var filter = icFrame.configUtil.loadConfig({}, 'filter');

            this.before = Object.keys(filter.before).length ? filter.before : false;
            this.after = Object.keys(filter.after).length ? filter.after : false;
        },
        getActionFilter: function(instance, action) {
            var disabled = instance['_DISABLED_FILTERS'],
                beforeDisabled = [],
                afterDisabled = [],
                before, after;

            var parseConfig = function(item) {
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

            if ((this.before || this.after) && disabled) {
                // for all action
                parseConfig(disabled['*']);
                // current action
                parseConfig(disabled[action]);

                if (beforeDisabled.length && this.before) {
                    before = {};
                    for (var key in this.before) {
                        if (!~beforeDisabled.indexOf(key)) {
                            before[key] = this.before[key];
                        }
                    }
                }
                if (afterDisabled.length && this.after) {
                    after = {};
                    for (var key in this.after) {
                        if (!~afterDisabled.indexOf(key)) {
                            after[key] = this.after[key];
                        }
                    }
                }
            }

            return {
                before: before || this.before,
                after: after || this.after
            };
        }
    };

mixFilter.init();
module.exports = mixFilter;