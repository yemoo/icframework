###

some basic usage example

###

'use strict'

Gearman = require('../Gearman').Gearman


# basic client: create a job and determine if it's been completed
client = new Gearman() # assumes localhost, port 4730  

# handle finished jobs
client.on 'WORK_COMPLETE', (job) ->
	console.log 'job completed, result:', job.payload.toString()
	#client.close()

# connect to the gearman server
client.connect ->
	# submit a job to uppercase a string with normal priority in the foreground
	client.submitJob 'upper', 'Hello, World!'


# basic worker: create a worker, register a function, and handle work
worker = new Gearman()

# handle jobs assigned by the server
worker.on 'JOB_ASSIGN', (job) ->
	console.log job.func_name + ' job assigned to this worker'
	result = job.payload.toString().toUpperCase()
	# notify the server the job is done
	worker.sendWorkComplete job.handle, result

	# go back to sleep, telling the server we're ready for more work
	worker.preSleep()

# grab a job when the server signals one is available
worker.on 'NOOP', ->
	worker.grabJob()

# connect to the gearman server	
worker.connect ->
	# register the functions this worker is capable of
	worker.addFunction 'upper'

	# tell the server the worker is going to sleep, waiting for work
	worker.preSleep()
