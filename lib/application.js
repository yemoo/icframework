/**
 * Module dependencies.
 */

var express = require('express'),
    app = express(),
    path = require('path');

/**
 * Initialize the server
 */
app.init = function(options) {
    return app;
}

app.get('/', function(req, res, next) {
    res.write("ok");

    icFrame.submitJob('reverse', " Hello World", function(job) {
        console.log(job.payload.toString());
    });

    console.log('the pid: ' + process.pid);
    res.end();
});

module.exports = app;