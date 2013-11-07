var division = require('division');
var cluster = new division();

// Configuration for all environments
// TIP: this is pointing to cluster
cluster.configure(function() {
	this.set('args', process.argv.slice(2));
	this.set('path', __dirname + '/worker.js');
});

// You can also set settings without configuration block
cluster.set('size', 1).set('timeout', 10000);

// Use extensions
// TIP: You can chain (almost) all methods
cluster.use('signals');

exports.start = function() {
	// Start your application as a cluster!
	var master = cluster.run(function() {
		// `this` is pointing to the Master instance
	});
}