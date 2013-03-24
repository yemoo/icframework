var cwd = process.cwd();

module.exports = {
    environment: 'development',
    hostname: '',
    port: 3000,
    // default view Engine
    viewEngine: 'dust',
    viewCache: true,
    // cookie/session secret key
    secretKey: 'ifchange',
    // cluster
    processNum: 1,
    // folder setting  WARN: you'd better don't change this setting
    viewDir: cwd + '/views',
    controllerDir: cwd + '/controllers',
    configDir: cwd + '/config',
    // TEMP: static folder
    staticDir: cwd + '/public'
};