var cwd = process.cwd();

module.exports = {
    environment: 'development',
    hostname: '',
    port: 3000,
    // default view Engine
    viewEngine: 'dust',
    viewCache: true,
    // TEMP: static folder
    staticPath: cwd + '/public',
    // cluster
    processNum: 10,
    // folder setting  WARN: you'd better don't change this setting
    views: cwd + '/views',
    controllers: cwd + '/controllers',
    configPath: cwd + '/config',
    // cookie/session secret key
    secretKey: 'ifchange'
};