var path = require('path'),
    fs = require('fs'),
    utils = icFrame.utils;

exports.readConfig = function(options) {
    var opts = options || {}, ret = {}, baseConfig, env, dir = process.cwd(),
        configPath = path.join(dir, 'config'),
        appBaseConfig = {}, appEnvConfig = {}, protocol, fullHostname;

    // frame base config
    baseConfig = utils.merge({}, require('../config/environment'));
    env = opts.environment || baseConfig.environment;

    // user base config
    if (fs.existsSync(configPath + '/environment' + '.js')) {
        appBaseConfig = require(configPath + '/environment');
    }
    // user env config
    if (fs.existsSync(configPath + '/' + env + '.js')) {
        appEnvConfig = require(configPath + '/' + env);
    }

    // Start with a blank slate, mix everything in
    utils.merge(ret, baseConfig);
    utils.merge(ret, appBaseConfig);
    utils.merge(ret, appEnvConfig);
    utils.merge(ret, opts);

    // NOW: must be in config folder
    ret.configPath = configPath;

    // default hostname: IP address
    if (!ret.hostname) {
        var os = require('os'),
            eth0 = os.networkInterfaces().eth0,
            IPv4 = '127.0.0.1';
        for (var i = 0; i < eth0.length; i++) {
            if (eth0[i].family == 'IPv4') {
                IPv4 = eth0[i].address;
            }
        }
        ret.hostname = IPv4;
    }
    // check port setting, default 3000.
    ret.port = parseInt(ret.port, 10) || process.env.PORT || 3000;

    // Construct fullHostname if not specifically set
    if (!ret.fullHostname) {
        protocol = ret.ssl ? 'https' : 'http';
        fullHostname = protocol + '://' + ret.hostname;
        if (ret.port != 80) {
            fullHostname += ':' + ret.port;
        }
        ret.fullHostname = fullHostname;
    }

    return ret;
};