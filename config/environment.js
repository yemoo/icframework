var cwd = process.cwd(),
    consolidate = require('consolidate'),
    viewDir = cwd + '/views',
    ctrlDir = cwd + '/controllers',
    configDir = cwd + '/config';

module.exports = {
    env: 'production',
    hostname: '',
    port: 80,
    timeout: 60000, // 1 min
    processNum: -1, // cluster, default user cpus number 
    //maxReqsPerChild: 1000,
    gzip: true,
    viewEngineMap: {
        'html': consolidate.dust,
        'just': consolidate.just
    },
    viewEngine: 'html', // default view Engine
    viewCache: true,
    cookie: {
        secret: 'ICFRAME'
    },
    session: {
        secret: 'ICFRAME',
        key: 'ICFRAME_SID'
    },
    express: {
        'case sensitive routing': true,
        'trust proxy': true
    },
    charset: 'utf-8',
    // security
    security: {
        global_xss_filtering: true,
        csrf_protection: false,
        csrf_token_name: '_csrf',
        utf8_enable: true
    },
    logger: undefined,
    debug: false,
    gearman: {
        clientNum: 20,
        maxClientNum: 100,
        timeout: 3000, // ms
        prefix: '',
        suffix: ''
    },
    // global variables
    locals: undefined,
    // folder setting  WARN: you'd better don't change this setting
    viewDir: viewDir,
    controllerDir: ctrlDir,
    configDir: configDir,
    // monitor dirs/files
    monitor: {
        'default': function(config) {
            return [viewDir, ctrlDir, configDir];
        }
    },
    monitorDelay: 5000,
    // static folder
    //staticDir: staticDir
};