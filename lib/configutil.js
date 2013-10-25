var fs = require('fs'),
    path = require('path'),
    os = require('os'),
    utils = require('utilities'),
    _require = function(file) {
        if (require.cache) {
            delete require.cache[require.resolve(file)];
        }
        return require(file);
    };
/*jshint bitwise:false */

function ip2long(IP) {
    // http://kevin.vanzonneveld.net
    // +   original by: Waldo Malqui Silva
    // +   improved by: Victor
    // +    revised by: fearphage (http://http/my.opera.com/fearphage/)
    // +    revised by: Theriault
    // *     example 1: ip2long('192.0.34.166');
    // *     returns 1: 3221234342
    // *     example 2: ip2long('0.0xABCDEF');
    // *     returns 2: 11259375
    // *     example 3: ip2long('255.255.255.256');
    // *     returns 3: false
    var i = 0;
    // PHP allows decimal, octal, and hexadecimal IP components.
    // PHP allows between 1 (e.g. 127) to 4 (e.g 127.0.0.1) components.
    IP = IP.match(/^([1-9]\d*|0[0-7]*|0x[\da-f]+)(?:\.([1-9]\d*|0[0-7]*|0x[\da-f]+))?(?:\.([1-9]\d*|0[0-7]*|0x[\da-f]+))?(?:\.([1-9]\d*|0[0-7]*|0x[\da-f]+))?$/i); // Verify IP format.
    if (!IP) {
        return false; // Invalid format.
    }
    // Reuse IP variable for component counter.
    IP[0] = 0;
    for (i = 1; i < 5; i += 1) {
        IP[0] += !! ((IP[i] || '').length);
        IP[i] = parseInt(IP[i]) || 0;
    }
    // Continue to use IP for overflow values.
    // PHP does not allow any component to overflow.
    IP.push(256, 256, 256, 256);
    // Recalculate overflow of last component supplied to make up for missing components.
    IP[4 + IP[0]] *= Math.pow(256, 4 - IP[0]);
    if (IP[1] >= IP[5] || IP[2] >= IP[6] || IP[3] >= IP[7] || IP[4] >= IP[8]) {
        return false;
    }
    return IP[1] * (IP[0] === 1 || 16777216) + IP[2] * (IP[0] <= 2 || 65536) + IP[3] * (IP[0] <= 3 || 256) + IP[4] * 1;
}

function ipToNum($ip) {
    var $n = ip2long($ip);

    /** convert to network order */
    $n = (($n & 0xFF) << 24) | ((($n >> 8) & 0xFF) << 16) | ((($n >> 16) & 0xFF) << 8) | (($n >> 24) & 0xFF);
    return $n;
}

function getIPAddress() {
    var ignoreRE = /^(127\.0\.0\.1|::1|fe80(:1)?::1(%.*)?)$/i,
        ifaces = os.networkInterfaces();

    for (var dev in ifaces) {
        for (var i = 0, l = ifaces[dev].length, detail; i < l; i++) {
            details = ifaces[dev][i];
            if (details.family === 'IPv4' && !ignoreRE.test(details.address)) {
                return details.address;
            }
        }
    }
    return '';
}

// App config file directory
var configpath = process.cwd() + '/config',
    setConfigPath = function(_path) {
        if (_path) {
            _path = path.resolve(_path);
            if (fs.existsSync(_path)) {
                configpath = _path;
            }
        }
    },
    mixConfig = function(ret, config, shortpath) {
        if (typeof config == 'string') {
            // default use configpath
            shortpath && (config = path.join(configpath, config));
            config = fs.existsSync(config) ? _require(config) : {};
        }
        return utils.mixin(ret || {}, config, true);
    },
    loadConfig = function(ret, name) {
        var basePath = __dirname + '/../config/' + name + '.js',
            userPath = name + '.js';

        !ret && (ret = {});
        // frame base config
        mixConfig(ret, basePath);
        // user base config
        mixConfig(ret, userPath, true);

        return ret;
    }, baseConfig = function(envCfg) {
        var ret = utils.mixin({}, envCfg),
            env = ret.env,
            appEnv,
            protocol, fullHostname;

        setConfigPath(ret.configpath);
        ret.configpath = configpath;

        // frame config
        loadConfig(ret, 'environment');

        // app config
        appEnv = env || ret.env;
        mixConfig(ret, appEnv + '.js', true);

        // command config
        envCfg && utils.mixin(ret, envCfg);
        ret.env = appEnv;

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

        ret.ipAddress = getIPAddress();
        ret.ipAddressNum = ipToNum(ret.ipAddress);
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

        //console.log(JSON.stringify(ret));
        return ret;
    };


module.exports = {
    baseConfig: baseConfig,
    mixConfig: mixConfig,
    loadConfig: loadConfig,
    setConfigPath: setConfigPath
};