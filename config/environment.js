var cwd = process.cwd(),
    consolidate = require('consolidate');

module.exports = {
    uid: 99,
    gid: 99,
    env: 'production',
    hostname: '',
    port: 80,
    timeout: 60000, // 1 min
    cache: true,
    //gzip: true,
    // view config
    view: {
        engines: {
            'html': consolidate.dust,
            'swig': consolidate.swig
        },
        cache: true,
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
    notFoundPage: {
        file: 'errors/404.html',
        absolute: false, // 绝对路径
        static: false,
        message: 'Page Not Found',
        logger: false
    },
    errorPage: {
        file: 'errors/500.html',
        absolute: false, // 绝对路径
        static: false,
        message: 'Internal Server Error',
        logger: function(err, req, res) {
            icFrame.logger.getLogger('exception').error(err.stack);
        }
    },
    log: {
        config: {
            appenders: {
                '[default]': {
                    type: 'file',
                    filename: 'nodelog-{app}-{env}-info.log',
<<<<<<< HEAD
                    maxLogSize: 204800000, // 200MB  2048(2k) X 1000 x100
=======
                    maxLogSize: 204800, // 2MB
>>>>>>> d29b899b95147a3756f61e1bdb27fbfd0c30c9cc
                    backups: 10
                },
                'gearman': {
                    type: 'file',
                    filename: 'nodelog-{app}-{env}-gearman.log',
<<<<<<< HEAD
                    maxLogSize: 204800000,
=======
                    maxLogSize: 204800,
>>>>>>> d29b899b95147a3756f61e1bdb27fbfd0c30c9cc
                    backups: 10
                },
                'exception': {
                    type: 'file',
                    filename: 'nodelog-{app}-{env}-exception.log',
<<<<<<< HEAD
                    maxLogSize: 204800000,
=======
                    maxLogSize: 204800,
>>>>>>> d29b899b95147a3756f61e1bdb27fbfd0c30c9cc
                    backups: 10
                },
                'access': {
                    type: 'file',
                    filename: 'nodelog-{app}-{env}-access.log',
<<<<<<< HEAD
                    maxLogSize: 204800000,
                    backups: 10,
                    config: {
                        level: 'auto'
                    }
=======
                    maxLogSize: 204800,
                    backups: 10
>>>>>>> d29b899b95147a3756f61e1bdb27fbfd0c30c9cc
                }
            }
        },
        accessOpt: {
            level: 'auto'
        },
        options: {
            cwd: '/opt/log/'
        }
    },
    debug: false,
    gearman: {
        group: {},
        config: {
            initClients: 10, // 初始化的连接数
            maxClients: 100, // 连接池中最大允许的连接数

            timeout: 3000, // job请求超时时长，默认3s

            reconnect: 60000, // 服务器标识为dead多久后尝试重新连接，，默认60s
            retries: 5, // 尝试连接次数，超过retries次数后标志该服务器为dead状态，默认5次
            retry: 3000, // 每次尝试连接的间隔时长，默认3s

            prefix: '', // jobName前缀
            suffix: '' // jobName后缀
        }
    },
    // path setting 
    ctrlpath: cwd + '/controllers'
};