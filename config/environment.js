var cwd = process.cwd(),
    consolidate = require('consolidate');

module.exports = {
    uid: 99,
    gid: 99,
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
        data: {}
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
    accesslog: {
        //format: 'default',
        //buffer: false,
        //stream: false,
        //immediate: false
    },
    debug: false,
    gearman: {
        group: {},
        config: {
            initClients: 10,    // 初始化的连接数
            maxClients: 100,  // 连接池中最大允许的连接数

            timeout: 3000, // job请求超时时长，默认3s

            reconnect: 60000, // 服务器标识为dead多久后尝试重新连接，，默认60s
            retries: 5, // 尝试连接次数，超过retries次数后标志该服务器为dead状态，默认5次
            retry: 3000, // 每次尝试连接的间隔时长，默认3s

            prefix: '', // jobName前缀
            suffix: '' // jobName后缀
        }
    },
    // path setting 
    ctrlpath: cwd + '/controllers',
    ignorewatch: "/node_modules|.git|.svn|\.log~?/i"
};