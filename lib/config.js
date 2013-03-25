var fs = require('fs'),
    utils = require('utilities');

exports.readConfig = function(options) {
    var opts = options || {}, ret = {}, baseConfig, env,
    configDir = process.cwd() + '/config',
        appBaseConfig = {}, appEnvConfig = {}, protocol, fullHostname;

    // frame base config
    baseConfig = utils.mixin({}, require('../config/environment'));
    env = opts.env || baseConfig.env;

    // user base config
    if (fs.existsSync(configDir + '/environment' + '.js')) {
        appBaseConfig = require(configDir + '/environment');
    }
    // user env config
    if (fs.existsSync(configDir + '/' + env + '.js')) {
        appEnvConfig = require(configDir + '/' + env);
    }

    // Start with a blank slate, mix everything in
    utils.mixin(ret, baseConfig);
    utils.mixin(ret, appBaseConfig);
    utils.mixin(ret, appEnvConfig);
    utils.mixin(ret, opts);

    // must be in 'config' folder
    ret.configDir = configDir;

    // ================= Compatible Express Settings =============
    if (ret.express) {
        var expressCfg = ret.express;
        if (!ret['env'] && typeof expressCfg['env'] != 'undefined') {
            ret['env'] = expressCfg['env'];
        }
        delete expressCfg['env'];
        if (!ret['viewCache'] && typeof expressCfg['view cache'] != 'undefined') {
            ret['viewCache'] = expressCfg['view cache'];
        }
        delete expressCfg['view cache'];
        if (!ret['viewEngine'] && typeof expressCfg['view engine'] != 'undefined') {
            ret['viewEngine'] = expressCfg['view engine'];
        }
        delete expressCfg['view engine'];
        if (!ret['viewDir'] && typeof expressCfg['views'] != 'undefined') {
            ret['viewDir'] = expressCfg['views'];
        }
        delete expressCfg['views'];
    }
    // ================= End Compatible Setting ==================

    // default hostname: IP address
    if (!ret.hostname) {
        var os = require('os'),
            networkIf = os.networkInterfaces(),
            eth0 = networkIf['eth0'] || networkIf['en0'] || networkIf['en1'] || [],
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
