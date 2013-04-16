var cwd = process.cwd();

var viewDir = cwd + '/views',
    ctrlDir = cwd + '/controllers',
    configDir = cwd + '/config',
    staticDir = cwd + '/public';

module.exports = {
    env: 'development',
    hostname: '',
    port: 3000,
    viewEngineMap: {
        'dust': function(engines) {
            return engines.dust;
        }
    },
    // default view Engine
    viewEngine: 'dust',
    viewCache: true,
    // cookie/session secret key
    secretKey: 'ifchange',
    // cluster, default 10 child-process
    processNum: 10,
    //maxReqsPerChild: 1000,
    express: {
        'case sensitive routing': true,
        'trust proxy': true
    },
    charset: 'utf-8',
    // security
    security: {
        global_xss_filtering: true,
        csrf_protection: true,
        csrf_token_name: '_csrf',
        utf8_enable: true
    },
    gearman: {
        clientNum: 10,
        maxClientNum: 20,
        timeout: 10000 // ms
    },
    // folder setting  WARN: you'd better don't change this setting
    viewDir: viewDir,
    controllerDir: ctrlDir,
    configDir: configDir,
    // moniter dirs/files
    monitor: [viewDir, ctrlDir, configDir, staticDir],
    monitorDelay: 5000,
    // TEMP: static folder
    staticDir: staticDir
};