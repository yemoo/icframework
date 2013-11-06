/* global icFrame */
var mixFilter = {
    init: function(reload) {
        if (reload || !this.filter) {
            this.filter = icFrame.configUtil.loadConfig({}, 'filter', reload);
            this.before = Object.keys(this.filter.before).length ? this.filter.before : false;
            this.after = Object.keys(this.filter.after).length ? this.filter.after : false;
        }
        return this;
    },
    getActionFilter: function(instance, action) {
        var disabled = instance._DISABLED_FILTERS,
            beforeDisabled = [],
            afterDisabled = [],
            init = this.init(), // 确保初始化过
            before = this.before,
            after = this.after,
            parseConfig = function(item) {
                if (item) {
                    if (Array.isArray(item)) {
                        beforeDisabled = beforeDisabled.concat(item);
                        afterDisabled = afterDisabled.concat(item);
                    } else {
                        if (item.before) {
                            beforeDisabled = beforeDisabled.concat(item.before);
                        }
                        if (item.after) {
                            afterDisabled = afterDisabled.concat(item.after);
                        }
                    }
                }
            },
            _before, _after;

        if ((before || after) && disabled) {
            // for all action
            parseConfig(disabled['*']);
            // current action
            parseConfig(disabled[action]);

            if (beforeDisabled.length && before) {
                _before = {};
                Object.keys(before).forEach(function(key) {
                    if (beforeDisabled.indexOf(key) < 0) {
                        _before[key] = before[key];
                    }
                });
            }
            if (afterDisabled.length && after) {
                _after = {};
                Object.keys(after).forEach(function(key) {
                    if (afterDisabled.indexOf(key) < 0) {
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

module.exports = mixFilter;