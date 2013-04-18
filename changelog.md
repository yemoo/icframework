[2013-04-18]
* add: gearman job prefix/suffix
* add: request logger config
* add: session storage config
* add: auto set processNum=cpu num when processing num less than 1
* update: restart a new workers when a worker was exit unnormally
* add: config gzip

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
