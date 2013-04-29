var cwd = process.cwd(),
    consolidate = require('consolidate');

module.exports = {
    env: 'production',
    hostname: '',
    port: 80,
    timeout: 60000, // 1 min
    gzip: true,
    // view config
    view: {
        engines: {
            'html': consolidate.dust,
            'just': consolidate.just
        },
        cache: true,
        timeout: 2000,
        path: cwd + '/views',
        // global variables
        data: undefined
    },
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
    // path setting 
    ctrlpath: cwd + '/controllers'
};