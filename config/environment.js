var cwd = process.cwd();

var viewDir = cwd + '/views',
    ctrlDir = cwd + '/controllers',
    configDir = cwd + '/config';

module.exports = {
    env: 'development',
    hostname: '',
    port: 3000,
    // default view Engine
    viewEngine: 'dust',
    viewCache: true,
    // cookie/session secret key
    secretKey: 'ifchange',
    // cluster, default 10 child-process
    processNum: 10,
    express: {
        'case sensitive routing': true,
        'trust proxy': true
    },
    charset: 'utf-8',
    // folder setting  WARN: you'd better don't change this setting
    viewDir: viewDir,
    controllerDir: ctrlDir,
    configDir: configDir,
    // moniter dirs/files
    monitor: [viewDir, ctrlDir, configDir],
    monitorDelay: 5000,
    // TEMP: static folder
    staticDir: cwd + '/public'
};