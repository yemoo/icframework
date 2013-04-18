var cwd = process.cwd();

var viewDir = cwd + '/views',
    ctrlDir = cwd + '/controllers',
    configDir = cwd + '/config',
    staticDir = cwd + '/public';

module.exports = {
    env: 'development',
    hostname: '',
    port: 3000,
    // cluster, default 10 child-process
    processNum: 10,
    //maxReqsPerChild: 1000,
    gzip: true,
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
    sessionStore: undefined, 
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
    logger: undefined,
    gearman: {
        clientNum: 20,
        maxClientNum: 100,
        timeout: 10000, // ms
        prefix: '',
        suffix: ''
    },
    // folder setting  WARN: you'd better don't change this setting
    viewDir: viewDir,
    controllerDir: ctrlDir,
    configDir: configDir,
    // moniter dirs/files
    monitor: [viewDir, ctrlDir, configDir, staticDir],
    monitorDelay: 5000,
    // server request monitor
    monitorReq: false,
    // TEMP: static folder
    staticDir: staticDir
};
