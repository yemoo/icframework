###

shows how to set a unique job id to prevent more than one job to be created at 
a time. This is useful in mitigating thundering herd problems

###

'use strict'

Gearman = require('./Gearman').Gearman

# create a client
client = new Gearman() # assumes localhost, port 4730  

# connect to the gearman server
client.connect ->
	# submit a to query a specific user
	client.submitJob 'user_lookup', '1234', { unique_id: 'luid:1234' }
