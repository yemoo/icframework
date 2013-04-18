[2013-04-18]
* add: gearman支持配置jobname的前缀与后缀
* add: 增加请求日志模块，可自行配置格式及存储位置等
* add: 支持配置session存储方式
* add: 当设置的ProcessNum小于1时，自动设置为cpu的数目
* update: 当一个worker异常推出时，自动启动一个新的worker
* add: 可配置是否开启gzip
* update: filter.js: 修改gearman返回数据的封装结构，同时统一gearman.js超时错误与服务端返回错误一致的格式
* update: 修改filter.js/router.js中关于配置读取的程度，统一使用configUtil.loadConfig方式读取
* update: 将框架中filter.js中的gearman.submitJob实现移到app中
* update: 解决ctrlUtil.render不传入data参数报错的问题 

[2013-04-17]
* update: change worker cache form array->object, remove iterate in exit event
* add: wait the worker finish its task before close the worker
* catch and record process exit and exception events
* monitor a request running time and memory useage for preformance analysis

[2013-04-16]
* update: merge gearman/viewEngineMap config to environment config file
* add: attemp implement submitJob Cache // temp comment the implement
* update: change config.js, remove _require method
* update: change icframe.js, move many icFrame properties to Worker instance only, and other changes 

[2013-04-15]
* add: bigpipe js
* add: controller.ctrlUtil bigpipe method support
* add memwatch

[2013-04-09]
* add icframe.config.ipAddress var
* change submitJob sencond param: (1) old ways (2){provider: '', params: ''}
* implement internal gearmand submitJob interface use frame filter
* use messagepack to send or receive gearman data
* remove header: x-powered-by;
* change session-key from default value 'connect.sid' to secretKey + '_SID'
* fix some gearman.js issues
