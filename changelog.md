[2013-04-09]
* add icframe.config.ipAddress var
* change submitJob sencond param: (1) old ways (2){provider: '', params: ''}
* implement internal gearmand submitJob interface use frame filter
* use messagepack to send or receive gearman data
* remove header: x-powered-by;
* change session-key from default value 'connect.sid' to secretKey + '_SID'
* fix some gearman.js issues
