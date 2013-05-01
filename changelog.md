[2013-05-01]
* 修改gearman输出callback错误信息为错误堆栈，将submitJob默认值设置为{}，否则如果为null时，node-gearman会报错
* 扩展res.sendError(err)方法，便于输出一些特定的错误到页面，与connect的报错一致

[2013-04-30]
* fixed: 修正部分情况下调用res.send()时不能正确输出content-type的问题
* update: 优化icframe的代码结构

[2013-04-29]
* update: 删除defaultEngine配置项，读取engines中的第一个key作为defaultEngine。 寻找模板文件时按照配置engines keys顺序寻找。
* update: 解决url路径中多个斜线导致解析失败的问题
* fixed: 修复模板超时报错的一些错误逻辑
* update: 修改res.end/res.write的一些错误处理逻辑，res.end不再支持非字符串参数。
* update: 修改ctrlUtil.run中的错误导致bigpipe失效的问题
* update: gearman对background任务的处理逻辑，解决gearman执行回调函数异常时报job timeout的错误的问题
* update: 文件监控的修改，支持view/controller在应用外不能监控的问题，同时避免文件重复监控。

[2013-04-27]
* add: 增加对模板解析超时的处理，避免模板设置不对或者内部出错等问题，
* add: 增加设置模板解析超时时间viewRenderTimeout，默认2000
* add: 模板渲染出错输出错误信息到页面
* add: 增加dustjs-helper插件
* update: 删除monitor配置，使用watch模块做整个目录的监控
* update: 删除processNum参数，改为命令行传递，默认为cpu数目
* update: 修改logger.console，增加第三个参数可传入一个标题
* update: 修改配置，将locals/viewDir/viewCache/viewEngine/viewEngineMap合并到view中
* update: 修改config.controllerDir为config.ctrlpath
* update: 删除config.configDir，修改config.mixConfig方法，支持传入第三个参数shortpath，自动合并configpath路径再查找
* add: 引入commander，支持命令行参数，-h, -v, -p等
* update: 修改session.cookie.expires设置问题，只能设置为数字类型，不能是date类型

[2013-04-26]
* add: ctrlUtil增加对validator的引用
* add: 增加res.addTplData(key, value) | addTplData(obj)方法，便于设置模板变量;
* update: 修改cookie.secertKey为cookie:{secert: 'xxx'}
* update: 合并session.secertKey与sessionStore到session配置中，直接配置connect-session的配置项
* update: 调整woker.js中的代码组织方式
* update: 修改config中模板的配置方式，不使用function配置
* add: 添加just模板引擎 
* update: ctrlUtil.render传入模板时也做一次有效性检查，无效则尝试读取默认模板
* update: 将session.store的解析放到config中
* update: 修改config.monitor中默认配置的监控文件引用方式

[2013-04-25]
* add: 当服务所用端口被占用时，提示用户并终止当前进程
* change: 修改node-validator为express-validator，与express更好集成

[2013-04-24]
* add: 支持全局配置中配置locals配置项，用于全局模板变量
* add: 支持在控制器中通过this._LOCALS配置该控制器中所有action公共的模板变量
* update: 更改控制器中DISABLED_FILTERS为_DISABLED_FILTERS，避免过滤器被url访问。
* update: 取消访问下划线开头action跳转到index的处理，直接返回404
* app-update: 解决filter.js中submitjob传入data为null报错的问题
* update: 将ctrl中的async属性分为chunked/async两个，chunked适用于bigpipe模式html页面组织（调用ctrlUril.run方法）
* update: 解决res.send/json/jsonp方法调用时报header已经设置的错误
* update: 修改res.render的封装，有回调函数则采用chunked模式直接输出header，否则不设置header，以与res.render本身逻辑相符
* update: res.end支持输出任何数据格式
* update: 将node-gearman模块移到node-modules中，并加入package.json，同时修改gearman.js的引用
* add: 通过res.locals增加模板变量req，默认包含'params/query/body/cookies/signedCookies/ip/ips/protocol/domain/path/host/xhr/url/originalUrl/method/originalMethod/session/headers/httpVersion'内容

[2013-04-23]
* add: 增加debug配置项，便于输出程序内的调试信息。
* update: 删除monitorReq配置项，和debug配置合并。所有debug信息都通过logger.debug输出
* add: ctrlUtil增加验证方法check/sanitize两个快捷方法（icFrame.validator.check/sanitize）
* update: 修改req上的__ctrlUtil__为ctrlUtil，便于书写。
* update: 控制器支持action为非函数（将作为response内容直接输出），支持配置方法值为'SHOW_VIEW'直接调用模板
* update: 修改ctrlUtil上的双下划线方法名为单下划线，统一单下划线为私有方法 

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
