IfChange Framework
==================
-----

简述
----
icFramework(icframe)是一个基于nodejs及基础web框架express等开源框架/库开发得web前端控制层框架。支持基本得MVC/gearman调用/异步输出等功能，提供一套简易编写web应用的解决方案。目前更是为逸橙内部前端架构需求定制的一个web框架。

功能列表
-------
* 简单配置，简单启动web项目
* 包含基础web服务所需功能，如session,gzip,默认的URL路由解析等
* 支持启动多进程web服务
* MVC结构代码组织方式
* 扩展的controller接口及可定制的模板引擎
* 可定制URL路由，如指定到特定的Controller.action并可指定默认末班
* 支持全局的REQ/RES过滤钩子，可实现一些请求过滤器等，支持在应用逻辑的Before/After截获
* 多线程gearman client自动调度，提供简单的submitJob接口
* 可实现多模块的异步输出，结合客户端JS可实现类facebook高性能bigpipe前端响应。
* 热部署，框架自动监控文件变动并重启服务，可自定义监控文件及目录及检测间隔时间
* 可作为node全局模块命令行运行，或者自己编写文件引用icframe模块并通过node启动

目录结构
-------
```
icframework
├── README.md // 说明文件
├── bin // 命令行工具
│   └── icframe.js // 命令行运行icframe的脚本
├── config // 默认配置文件
│   ├── environment.js // 全局环境配置
│   ├── filter.js // 内置过滤器
│   └── viewengine.js // 内置模板引擎的支持（dust, handlerbars）
├── index.js // 通过模块引用方式调用icframe的入口文件
├── lib // 框架功能实现文件
│   ├── application.js // web服务初始化, 路由/控制器/view处理逻辑
│   ├── config.js // 读取并合并环境配置，框架env/app env/dev|pro合并及一些配置信息的处理
│   ├── filter.js  // filter配置合并 及 action级别filter的一些处理逻辑
│   ├── gearman.js // 根据gearman配置初始化gearman并做任务调度，提供全局submitJob接口
│   ├── icframe.js // 入口文件,读取配置/app,gearman init/多进程管理/文件监控/启动web服务
│   ├── instancectrl.js  // 为所有控制器实例初始化一些内部变量及icRun/icRender两个方法
│   ├── logger.js // 默认的logger实现，及合并用户扩展的logger
│   ├── node-gearman // gearman官方推荐的node版本实现
│   └── router.js // 读取router配置文件并解析成容易处理的格式
├── node_modules // 框架依赖的第三方模块
│   ├── async
│   ├── consolidate
│   ├── dustjs-linkedin
│   ├── express
│   ├── inflection
│   ├── utilities
│   └── winston
└── package.json // 框架基本信息及模块依赖等
```

安装及启动
--------
* **框架初始化**  
  进入icframework目录，运行`npm install`，自动安装第三方依赖模块。
* **两种使用方式**
  1. 纯命令行方式运行
     1. 首先将icframe注册为全局包，进入icframework目录，运行`sudo npm link`将icframe链接到全局。
     2. 进入项目目录，如icframeapp，运行`icframe`即可。
  2. 模块引用方式运行
     1. 进入项目目录。新建一个js文件，如server.js，输入以下代码保存：
     
       ```
       var icframe = require('icframe');
       icframe.start();
       ```
     2. 在项目目录下，运行`node server.js`即可。

配置及功能详述
------------

### 环境配置

### 路由配置

### 过滤器

### Gearman配置

### 日志使用及定制

### 模板引擎配置

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
