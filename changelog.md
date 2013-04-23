[2013-04-23]
* add: 增加debug配置项，便于输出程序内的调试信息。

[2013-04-22]
* update: router支持:xxx格式的简单匹配符，同时映射的url也支持对应的匹配符，以实现更灵活的url router
* update: controller不支持下划线开头的方法（原来是不支持双下划线开头格式）
* update: 修改monitor配置项为object格式，支持用不同的key配置多个，每个配置格式可为函数，字符串或者数组，框架自动合并结果为数组。
* add: 增加对node安装版本的检测，读取package.json中配置的最小版本node号来对比当前所安装版本
* update: 默认关闭csrf_protection
* update: 框架默认不设置staticDir
* update: 默认模板后缀改为html, 默认env为production

[2013-04-19]
* update: 修改默认processNum为默认读取cpu数目
* update: 修改application.js中对url路由解析的逻辑，提供更灵活的解析机制和更简化的代码i
* update: 修改配置路由的一些格式，采用类似urlrewrite格式定义，callback改为mappedUrl
* update: 修改ctrlUtil.render内部实现，支持data为function格式，同时自动将非object/string格式转换为string
* fixed: 解决res.render/json/jsonp/send数据时无法正常输入到页面的问题（重写四个方法，调用时自动设置async模式为true）
* fixed: 解决res.render数据为object，同时找不到模板时报错问题（改为send(json输出)）
* add: config.timeout, 设置一个请求最长响应时间，默认为1分钟
* fixed: 解决通过res.end('xxxx')无法输出数据到页面的问题，将res.end的参数传递给res.write再执行res.end(). [第二种结局方案：将带参数res.end请求设置async=true]
* update: 修改gearman默认超时时间为3s

[2013-04-18]
* add: gearman支持配置jobname的前缀与后缀
* add: 增加请求日志模块，可自行配置格式及存储位置等
* add: 支持配置session存储方式
* add: 当设置的ProcessNum小于1时，自动设置为cpu的数目
* update: 当一个worker异常推出时，自动启动一个新的worker
* add: 可配置是否开启gzip
* update: filter.js: 修改gearman返回数据的封装结构，同时统一gearman.js超时错误与服务端返回错误一致的格式
* update: 修改filter.js/router.js中关于配置读取的程度，统一使用configUtil.loadConfig方式读取
* update: 将框架中filter.js中的gearman.submitJob实现移到app的filter中
* fixed: 解决ctrlUtil.render不传入data参数报错的问题 

[2013-04-17]
* update: 将worker缓存的实现由Array换成Object，队列中worker的删除改为由cluster自己控制。
* add: 关闭一个worker前等待其自身处理完成当前进程的任务，如果超时则强制退出
* add: 捕获并纪录cluster/woker进程的异常和退出信息到日志中
* add: 增加对一个请求运行时间和内存消耗的监控，便于分析程序性能

[2013-04-16]
* update: 合并gearman及viewEngineMap的配置信息到环境配置中，减少配置文件数
* add: 实现对submitJob的缓存，避免重复请求，提升性能。PS：暂时先注释了，等需要时再启用代码
* update: config.js的一些小修改
* update: 修改icframe.js, 分离cluster/worker代码文件，简化cluster中无效的一些属性，只负责子进程的调度

[2013-04-15]
* add: 实现bigpipe js
* add: controller.ctrlUtil中支持bigpipe方法，便于编写bigpipe程序
* add: 增加memwatch做内存分析及监控

[2013-04-09]
* add: 增加ipAddress配置，用于配置服务器IP，默认自行读取
* update: 改变submitJob方法第二个参数的格式支持: (1) 数据 (2){provider: 所在APP, params: 数据}
* add: 根据与后端约定的接口对submitJob做二次封装，在filter中实现
* add: 使用messagepack处理gearman数据的收发
* update: 删除header: x-powered-by;
* update: 将session-key由默认的connect.sid改为secretKey + '_SID'
* fixed: 修改一些gearman.js的问题
