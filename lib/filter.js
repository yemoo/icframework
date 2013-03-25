var fs = require('fs'),
	path = require('path'),
	utils = require('utilities'),
	mixFilter = {
		init: function() {
			var configDir = icFrame.config.configDir,
				userFilterFile = path.join(configDir, 'filter.js'),
				getList = this.getList,
				before = {},
				after = {},
				baseFilter,
				userFilter;

			// frame base filters
			baseFilter = require('../config/filter');
			utils.mixin(before, getList(baseFilter.before));
			utils.mixin(after, getList(baseFilter.after));

			if (fs.existsSync(userFilterFile)) {
				userFilter = require(userFilterFile);
				utils.mixin(before, getList(userFilter.before));
				utils.mixin(after, getList(userFilter.after));
			}

			this.before = Object.keys(before).length ? before : false;
			this.after = Object.keys(after).length ? after : false;
		},
		getList: function(item) {
			return item && typeof item == 'object' ? item : {};
		},
		getActionFilter: function(instance, action) {
			var disabled = instance['DISABLED_FILTERS'],
				forAllAction,
				beforeDisabled = [],
				afterDisabled = [],
				before, after;

			var parseConfig = function(item) {
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
				forAllAction = disabled['*'];
				forAllAction && parseConfig(forAllAction);
				disabled = disabled[action];
				disabled && parseConfig(disabled);

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