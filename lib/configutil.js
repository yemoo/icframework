var fs = require('fs'),
    path = require('path'),
    utils = require('./frameutil'),
    configpath = process.cwd() + '/config';

function initConfigPath(_path) {
    if (_path) {
        _path = path.resolve(_path);
        if (fs.existsSync(_path)) {
            configpath = _path;
        }
    }
    return configpath;
}

function mixConfig(ret, config, shortpath, reload) {
    if (typeof config === 'string') {
        // default use configpath
        shortpath && (config = path.join(configpath, config));
        config = fs.existsSync(config) ? (!reload ? require(config) : utils.frame.forcerequire(config)) : {};
    }
    return utils.mixin(ret || {}, config, true);
}

function loadConfig(ret, name, reload) {
    var basePath = __dirname + '/../config/' + name + '.js',
        userPath = name + '.js';

    !ret && (ret = {});
    // frame base config, 框架配置不传递reload参数
    mixConfig(ret, basePath, false);
    // user base config
    mixConfig(ret, userPath, true, reload);

    return ret;
}

function baseConfig(cfg) {
    var ret = {},
        envCfg = cfg || {},
        appEnv, protocol, fullHostname;

    initConfigPath(envCfg.configpath);
    // frame config
    loadConfig(ret, 'environment');

    // app config
    appEnv = cfg.env || ret.env;
    mixConfig(ret, appEnv + '.js', true);

    // command config
    envCfg && utils.mixin(ret, envCfg);
    ret.env = appEnv;
    ret.configpath = configpath;

    // add pid to config
    ret.pid = process.pid;
    // appName, default use process.pid general a name
    if (!ret.app) {
        ret.app = 'app_' + process.pid;
    }

    ret.uid = +ret.uid || ret.uid;
    ret.gid = +ret.gid || ret.gid;

    // ================= Compatible Express Settings =============
    var expressCfg = ret.express;
    if (expressCfg) {
        if (!ret.env && typeof expressCfg.env !== 'undefined') {
            ret.env = expressCfg.env;
        }
        delete expressCfg.env;
        if (!ret.view.cache && typeof expressCfg['view cache'] !== 'undefined') {
            ret.view.cache = expressCfg['view cache'];
        }
        delete expressCfg['view cache'];
        if (!ret.view.defaultEngine && typeof expressCfg['view engine'] !== 'undefined') {
            ret.view.defaultEngine = expressCfg['view engine'];
        }
        delete expressCfg['view engine'];
        if (!ret.view.path && typeof expressCfg.views !== 'undefined') {
            ret.view.path = expressCfg.views;
        }
        delete expressCfg.views;
    }
    // ================= End Compatible Setting ==================

    ret.ipAddress = utils.frame.getIPAddress();
    ret.ipAddressNum = utils.frame.ipToNum(ret.ipAddress);
    // default hostname: IP address
    !ret.hostname && (ret.hostname = ret.ipAddress || '127.0.0.1');
    // check port setting, default 80
    ret.port = parseInt(ret.port, 10) || process.env.PORT;

    // Construct fullHostname if not specifically set
    if (!ret.fullHostname) {
        protocol = ret.ssl ? 'https' : 'http';
        fullHostname = protocol + '://' + ret.hostname;
        if (ret.port !== 80) {
            fullHostname += ':' + ret.port;
        }
        ret.fullHostname = fullHostname;
    }

    return ret;
}


module.exports = {
    baseConfig: baseConfig,
    mixConfig: mixConfig,
    loadConfig: loadConfig
};