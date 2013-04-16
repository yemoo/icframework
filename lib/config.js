var fs = require('fs'),
    utils = require('utilities');

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
    $n = ip2long($ip);

    /** convert to network order */
    $n = (($n & 0xFF) << 24) | ((($n >> 8) & 0xFF) << 16) | ((($n >> 16) & 0xFF) << 8) | (($n >> 24) & 0xFF);
    return $n;
}

function getIPAddress() {
    var ignoreRE = /^(127\.0\.0\.1|::1|fe80(:1)?::1(%.*)?)$/i,
        ifaces = require('os').networkInterfaces(),
        dev, alias, ipAddress;
    for (dev in ifaces) {
        ifaces[dev].some(function(details) {
            if (details.family == 'IPv4') {
                if (!ignoreRE.test(details.address)) {
                    ipAddress = details.address;
                    return true;
                }
            }
        });
    }
    return ipAddress;
}

var readConfig = function() {
    var ret = {},
        configDir = process.cwd() + '/config',
        appBaseConfig = {},
        appEnvConfig = {},
        baseConfig, protocol, fullHostname;

    // frame base config
    baseConfig = require('../config/environment');
    // Start with a blank slate, mix everything in
    utils.mixin(ret, baseConfig, true);

    // user base config
    if (fs.existsSync(configDir + '/environment.js')) {
        appBaseConfig = require(configDir + '/environment.js');
        utils.mixin(ret, appBaseConfig, true);
    }

    // user env config
    if (fs.existsSync(configDir + '/' + ret.env + '.js')) {
        appEnvConfig = require(configDir + '/' + ret.env);
        utils.mixin(ret, appEnvConfig, true);
    }

    // config files must be in 'config' folder
    ret.configDir = configDir;

    // merge extra monitors
    if (ret['extraMonitor']) {
        ret['monitor'] = ret['monitor'].concat(ret['extraMonitor']);
        delete ret['extraMonitor'];
    }
    // ================= Compatible Express Settings =============
    var expressCfg = ret.express;
    if (expressCfg) {
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

    ret.ipAddress = getIPAddress();
    ret.ipAddressNum = ipToNum(ret.ipAddress);
    // default hostname: IP address
    if (!ret.hostname) {
        ret.hostname = ret.ipAddress || '127.0.0.1';
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
//console.log(JSON.stringify(ret));
    return ret;
};

module.exports = readConfig();