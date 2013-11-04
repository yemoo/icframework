# IfChange Framework
--------------------

## 简述
icFramework(icframe)是一个基于nodejs/express开源框架及多个第三方nodejs库开发的web前端控制层框架。支持基本MVC/gearman调用/异步输出等功能，提供一套简易编写web应用的解决方案。目前是为逸橙内部前端架构需求定制的一个web框架。

## 功能列表
* 简单配置，简单启动web应用
* 包含基础web服务所需功能，如session,gzip,默认的URL路由解析等
* 类MVC结构的代码组织方式
* 扩展的controller工具方法及灵活可定制的模板引擎支持
* 完善的默认URL路由解析机制，以及可定制URL路由，可指定到特定的Controller.action并可为其设置默认模版
* 支持全局的REQ/RES过滤钩子，可实现一些请求过滤器等，支持应用处理逻辑上的Before/After截获处理
* 多个gearman-client服务连接的自动调度，提供简单的submitJob任务调用接口
* 可实现多模块的异步输出，结合客户端JS可实现类facebook的高性能bigpipe前端响应。
* 热部署，框架自动监控文件变动并重启服务，可自定义监控文件及目录及检测间隔时间
* 自动监控异常的进程退出并启动新进程，确保web服务的正常提供
* 可作为node全局模块命令行运行，或者自己编写文件引用icframe模块并通过node启动

## 目录结构
```
icframework
├── bin
│   └── icframe.js
├── changelog.md
├── config
│   ├── environment.js
│   ├── filter.js
│   ├── filters
│   ├── plugin.js
│   └── plugins
├── index.js
├── lib
│   ├── application.js
│   ├── configutil.js
│   ├── ctrlutil.js
│   ├── errorhandler.js
│   ├── errors
│   ├── filter.js
│   ├── frameutil.js
│   ├── gearman.js
│   ├── logger.js
│   ├── router.js
│   ├── security.js
│   └── worker.js
├── node_modules
│   ├── commander
│   ├── consolidate
│   ├── dustjs-helpers
│   ├── dustjs-linkedin
│   ├── express
│   ├── express-validator
│   ├── iconv
│   ├── log4js
│   ├── memwatch
│   ├── msgpack
│   ├── node-gearman
│   ├── semver
│   ├── swig
│   └── utilities
├── package.json
└── README.md
```

## 安装及启动

### 基本运行环境要求
  1. nodejs v0.10.4+
  2. npm v1.2.15+

### 框架初始化
  首先进入icframework目录，运行`npm install`，框架自动安装第三方依赖模块。
  
### 两种使用方式
  1. **纯命令行方式运行**  
    首先将icframe注册为全局包。注册方式为：进入icframework目录，运行`sudo npm link`将icframe链接到全局。  
    进入项目目录，如icframeapp，运行`icframe`即可。
  2. **模块引用方式运行**  
    进入项目目录。新建一个js文件，如server.js，输入以下代码保存：

      ```js
var icframe = require('icframe');
icframe.start();
      ```
    在项目目录下，运行`node server.js`即可。

