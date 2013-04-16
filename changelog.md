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
