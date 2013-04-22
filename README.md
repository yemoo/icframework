# IfChange Framework
--------------------

## 简述
icFramework(icframe)是一个基于nodejs/express开源框架及多个第三方nodejs库开发的web前端控制层框架。支持基本MVC/gearman调用/异步输出等功能，提供一套简易编写web应用的解决方案。目前是为逸橙内部前端架构需求定制的一个web框架。

## 功能列表
* 简单配置，简单启动web应用
* 包含基础web服务所需功能，如session,gzip,默认的URL路由解析等
* 支持启动多进程web服务，提供更好的访问性能
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
├── README.md // 框架介绍文档
├── bin // 命令行工具
│   └── icframe.js // 命令行运行icframe的脚本的入口
├── changelog.md // 框架更新日志
├── config // 框架默认配置信息
│   ├── environment.js // 全局环境配置
│   └── filter.js // 内置过滤器
├── index.js // 通过模块引用方式调用icframe的入口文件
├── lib // 框架功能文件
│   ├── application.js // web服务初始化, 路由/控制器/view处理逻辑
│   ├── configutil.js // 框架配置信息读取及合并，配置文件读取工具方法
│   ├── ctrlutil.js // 为所有控制器实例提供一些工具方法及属性，并提供run/render两个方法
│   ├── filter.js // filter配置合并及解析
│   ├── gearman.js  // 根据gearman配置初始化gearman并做任务调度，提供全局submitJob接口
│   ├── icframe.js // 入口文件, 主进程文件，处理子进程的管理调度，以及文件修改的监控等
│   ├── logger.js  // 框架logger实现，默认的logger实现合并用户扩展的logger实现
│   ├── node-gearman // gearman官方推荐的node版本实现程序
│   ├── router.js // 读取router配置文件并解析成容易处理的格式
│   ├── security.js // 参考PHP CI框架实现的安全过滤插件，处理常见的参数过滤，XSS及CSRF安全问题
│   └── worker.js // web服务具体实现程序，由主进程icframe.js调用，用于处理真正的web请求
├── node_modules // 框架依赖的第三方模块
│   ├── async
│   ├── consolidate
│   ├── dustjs-linkedin
│   ├── express
│   ├── iconv
│   ├── inflection
│   ├── memwatch
│   ├── msgpack
│   ├── printf
│   ├── utilities
│   ├── validator
│   └── winston
└── package.json // 框架基本信息及模块依赖信息等
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

## 配置详解

### [环境配置]
* 配置文件：environment.js, development.js, production.js
* 默认配置信息一般在environment.js中配置；
* 针对不同的运行环境，可在development.js(开发环境)，production.js(产品环境)中配置
* 具体包含配置项如下：
  * **env：** 当前运行环境。该配置将决定框架引用production.js还是development.js。 *默认为production*
  * **hostname：** web服务器主机名（域名）。 *默认使用当前运行机器的IP地址*
  * **port：** web服务器端口号。 *默认为80*
  * **fullHostname：** 完整的web服务器名，如http://www.xxx.com:4000/。 *默认自动解析*
  * **timeout：** 一个请求最长的响应时间（单位为毫秒），超过该时间服务器将返回超时信息。 *默认为1分钟*
  * **processNum：** 启动的服务器子进程数目。 *默认启动数据和cpu数目相同，如4核CPU则启动4个子进程*
  * **gzip：** 是否开启gzip压缩。 *默认为true*
  * **viewEngineMap：** 支持的模版引擎配置，该配置的值为Object格式；每个键值对的KEY代表模版后缀名，VALUE为该后缀模版的解析引擎（一般为function，该function默认接收一个参数engines，即[consolidate对象](https://github.com/visionmedia/consolidate.js)，该插件默认支持很多模版引擎，具体可参看其文档）。 *默认配置（只支持[dustjs-linkedin](https://github.com/linkedin/dustjs)）为：* `
       viewEngineMap: {
          'html': function(engines) {
              return engines.dust;
          }
      }
     `
  * **viewEngine：** 默认的模版引擎（后缀），当程序中调用模版未写模板后缀时自动使用此处配置的后缀。 *默认为html
  * **viewCache：** 是否缓存模版（启用缓存可避免每次模版渲染都从文件系统调用）。 *默认为true*
  * **secretKey：** cookie/session加密key，用于防止客户端伪造cookie。 *默认为ifchange*
  * **sessionStore：** session存储方式，为了实现分布式等部署，可能要配置为数据库或者memcache来存储session。 *默认为内存存储方式* 此配置项的类型为function，该function默认接收一个参数express，该function要返回一个存储类型实例。具体可参看[connect.session](http://www.senchalabs.org/connect/session.html)介绍，更多的第三方session存储实现可参看[此页](https://github.com/senchalabs/connect/wiki)Session Store部分。
  * **charset：** 项目文件编码类型。 *默认为utf-8*
  * **security：** 安全配置项，该配置项下有4个子配置项。
    * **global_xss_filtering：** 是否全局启用XSS过滤。 *默认为true*
    * **csrf_protection：** 是否全局启用CSRF保护机制，启用后所有表单提交都必须有token隐藏域。 *默认为false*
    * **csrf_token_name：** CSRF参数的名称，用于表单隐藏域的name，一般无需修改。 *默认为_token*
    * **utf8_enable：** 是否过滤请求信息中的非utf-8字符。 *默认为true*
  * **express：** 该配置的值为object，用于设置express的[配置](http://expressjs.com/api.html#app-settings)。当express配置和框架配置项含义一样时（如env,viewEngine,viewCache,views），框架配置优先。
  * **logger：** 服务器请求日志的配置。如果参数为null/undefined/false等无效值则不启用日志，如果启用则配置项值应为object类型，其中可配置日志输出格式，输出到哪里等信息。具体可参看[Connect-logger](http://www.senchalabs.org/connect/logger.html)介绍。 *默认为undefined*
  * **gearman：** gearman服务配置项，该配置项包含6个配置项。
    * **server：** 配置gearman Server，数组格式，可配置多个，每条配置格式{ip:‘192.168.0.201’,port:'4730'}。 *默认无*
    * **clientNum：** 服务器启动时每个进程默认建立的gearman client连接数。 *默认为20*
    * **maxClientNum：** 每个进程最多创建的连接数。*默认为100*
    * **timeout：** 每个job请求的默认超时时间，超过该时间则返回gearman请求超时的信息。 *默认为3000（3秒）*
    * **preifix：** jobName前缀，配置该前缀时，每个submitJob的调用name都会在请求时自动加上该前缀，如配置preifix: 'temp_'，则submitJob('job1')实际请求的时temp_job1。 *默认为空*
    * **suffix：** jobName后缀，同prefix。 *默认为空*
  * **viewDir：** 模版目录。 *默认为views*
  * **controllerDir：** 控制器程序目录。 *默认为controllers*
  * **[configDir：]** 配置文件目录。**该项不可修改**。 *默认值为config目录*
  * **monitor：** 监控的文件（夹），格式为object，支持用不同的key配置多个，每个配置的value格式可为函数(函数接收一个config参数可以取到所有配置项)，字符串或者数组，框架自动合并结果为数组。该配置中文件变化时会自动重启服务。 *默认key->value为default=>viewDir/controllerDir/configDir。
  * **monitorDelay：** 监控检查间隔时间。 *默认为5000（5秒）*
  * **monitorReq：** 是否监控每个请求处理器执行时间及内存消耗，一般用于查看程序性能。 *默认为false*

### 路由配置
#### 默认路由解析机制
  对于一个URL，首先提取path内容（如 http://192.168.1.150:4000/hunter/positions/show?id=2 的path为 hunter/positions/show）
  * **处理程序(Controller/action)路由机制**  
    1. 首先假设最后一级路径为action，前一级为controller（即文件名，如positions.js），之前的路径为目录，按照此方法寻找此controller及是否有对应的action。
    2. 如果方式1中寻找不到controller文件或者controller中无对应action定义，则假设action为index，最后一级为controller，之前路径为目录。
    3. 注：在方式1/2中，如果path中没有controller或者action部分，则默认为index。如"/" 对应index.js中的index方法，“/users”对应index.js中users方法，或者users.js中的index方法。
    4. 如果找到解析的程序，则进行处理，否则返回404错误。
  * **模板路径路由机制**  
    view解析机制比较简单，一般直接采用“模板目录+path+‘.’+默认后缀”的方法查找。
  
#### 自定义路由解析
  有些情况我们可能需要对一些URL进行一些不同的解析，如一些rewrite之类的需求，

### 过滤器

### 日志使用及定制


控制器编写
--------
### 基本规范及结构
### 直接响应
* 基本输出
* 自由数据返回
* 强制定制输出类型

### 异步输出响应
### gearman调用
### 控制器过滤器配置

dust模板引擎介绍
--------------

winston Logger介绍
-----------------
