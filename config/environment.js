var cwd = process.cwd();

var viewDir = cwd + '/views',
    ctrlDir = cwd + '/controllers',
    configDir = cwd + '/config',
    staticDir = cwd + '/public';

module.exports = {
    env: 'development',
    hostname: '',
    port: 80,
    timeout: 60000, // 1 min
    processNum: -1, // cluster, default user cpus number 
    //maxReqsPerChild: 1000,
    gzip: true,
    viewEngineMap: {
        'dust': function(engines) {
            return engines.dust;
        }
    },
    viewEngine: 'dust', // default view Engine
    viewCache: true,
    secretKey: 'ifchange', // cookie/session secret key
    sessionStore: undefined, // session store config [function]
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

    monitor: [viewDir, ctrlDir, configDir, staticDir], // monitor dirs/files
    monitorDelay: 5000,

    monitorReq: false, // server request monitor

    // static folder
    staticDir: staticDir
};