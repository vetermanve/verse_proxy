var app = require('http').createServer(function handler(req, res) { HttpHandler.handle(req, res); });
var Cookies = require( "cookies" );
var io = require('socket.io')(app);
var fs = require('fs');
var url = require("url");
var rabbit = require('rabbit.js');
var identity = require('./modules/identity.js').identity;
var backendProtocol = require('./modules/restRequest.js');
var uuid = require("uuid");

// var HashTable = require('hashtable');

var blog = {
    prefix : null,
    showDebugLogs : false,
    prefixLen : 13,
    startTime : 0,
    log : function (info, warn ) {
        warn = warn || false;
        if (!this.prefix) {
            this.prefix = identity.getNodeId()       
        }
        
        if (!blog.startTime) {
            blog.startTime = Date.now();
        }
        
        if (this.prefix.length < this.prefixLen) {
            this.prefix += (new Array(this.prefixLen - this.prefix.length + 1).join(' '));
        }
        
        info = this.prefix + ' [' + Math.round((Date.now()- blog.startTime))/1000  + '] > ' + (typeof info != 'string' ? JSON.stringify(info, null, 4) : info);
        
        if (warn) {
            console.warn(info);
        } else if(this.debug) {
            console.log(info);    
        }
    },
    warn : function (info) {
       this.log(info, true); 
    }, 
    debug : function (info) {
        if (this.showDebugLogs) {
            this.log(info);    
        }
    },
    error : function (info) {
        this.log(info, true);
    }
};


var ReqPerformance = {
    logs : [],
    log : {
        cnt : 0,
        avg : 0,
        time : 0
    },
    id : 0 ,
    add: function (exTime) {
        var timeId = Math.floor(Date.now()/1000);

        // console.log('add '  + exTime, JSON.stringify(this));
        
        if (this.id != timeId) {
            if (this.log.cnt) {
                this.logs.push(Object.assign({},  this.log)); 
            }
            
            if (this.logs.length > 10) {
               this.logs.shift(); 
            }

            this.log = {
                id : timeId,
                date : new Date(timeId * 1000).toISOString(),
                cnt : 0,
                avg : 0,
                time : 0
            };
            
            this.id = timeId;
        }

        this.log.cnt++;
        this.log.time += exTime;
        this.log.avg = Math.round((this.log.time / this.log.cnt * 10000))/10000;
    }
};

var Haven = {
    routes : {
        'all' : 20
    },
    
    clouds : {},
    
    getCloud : function(name) {
        if (!this.clouds[name]) {
            var cloud = Object.create(AmqpCloudPublisher);
            cloud.init('amqp://' + identity.amqpHost, identity.getPublishQueue(name), name);
            this.clouds[name] = cloud;
        }
        
        return this.clouds[name];
    }
};

/**
 * Main Http consumer
 *
 * @type {{handle: HttpHandler.handle}}
 */
var HttpHandler = {
    logger : {},
    log : function (data) {
        this.logger.log(data);
    },
    init : function () {
        this.logger = Object.create(blog);
        this.logger.prefix = 'HttpHandler';
    },
    handle: function (httpRequest, httpResult) {
        var urlData = url.parse(httpRequest.url);

        if (urlData.pathname == '/favicon.ico') {
            httpResult.writeHead(404);
            httpResult.end();
            return;
        }

        if (urlData.pathname == '/node-status') {
            httpResult.writeHead(200);
            httpResult.write(JSON.stringify(ReqPerformance.logs));
            httpResult.end();
            return;
        }

        var method = httpRequest.method;

        var backendRequest = backendProtocol.buildRequestObj(httpRequest.method, urlData.pathname, urlData.query, identity.getResultQueue());
        backendRequest.resultStream = httpResult;
        backendRequest.request = httpRequest;
        backendRequest.cookies = new Cookies(backendRequest.request, backendRequest.resultStream);
        backendRequest.body.headers= httpRequest.headers;

        Requests.register(backendRequest);
        // this.log(backendRequest.body);
        this.log('Incoming request ' + backendRequest.uid + ' ' + backendRequest.body.method + ' ' + backendRequest.body.path);

        if (method == 'POST' || method == 'PUT') {
            this.catchBody(httpRequest, backendRequest);
        } else  {
            this.process(backendRequest)
        }
    },
    catchBody : function (httpRequest, restRequest) {
        var self = this;
        var body = [];

        httpRequest.on('data', function(chunk) {
            body.push(chunk);
        }).on('end', function() {
            restRequest.setData(Buffer.concat(body).toString());
            self.process(restRequest);
        }).on('error', function () {
            Requests.clearRequest(restRequest.uid, 'httpRequest error on catchBody');
        });
    },
    process : function (backendRequest) {
        var cloudName = Object.keys(Haven.routes)[0];
        Haven.getCloud(cloudName).add(backendRequest);
        backendRequest.setData('cleared');
    }
};


var Requests = {
    timing : [],
    logId : [],
    process : {},
    init : function () {
        this.process = new Map();  
    },
    register: function (backendRequest) {
        var uid = backendRequest.uid;
        var self = this;
        this.process.set(uid, backendRequest);
        
        backendRequest.resultStream.on('close', function() {
            self.clearRequest(uid, 'remote stream close');
        });
        backendRequest.resultStream.on('error', function () {
            self.clearRequest(uid, 'result stream error');
            blog.error('Requests: error on http request on ' + backendRequest.body.method + " "+ backendRequest.body.path);
        });
    }, 
    clearRequest : function (uid, reason) {
        reason = reason || 'unknown';
        this.process.delete(uid);
        blog.warn('Http request closed ' + uid + " by reason: " + reason);
    },
    writeResponse : function (uid, code, head, body, state) {
        var backendRequest = this.process.get(uid);

        code = code || 503;

        if (typeof backendRequest == 'undefined') {
            blog.warn('uid ' + uid + ' result object not found. Body skip');
            return false;
        }

        var res = backendRequest.resultStream;
        backendRequest.addTrace('Requests writeResponse');

        var processing = (Date.now() - backendRequest.born) / 1000;
        ReqPerformance.add(processing);

        res.shouldKeepAlive = false;
        
        var cookies = backendRequest.cookies;

        try {
            var stateItem;
            var domain = backendRequest.request.headers['origin'];
            
            if (domain) {
                domain = domain.split('.').slice(-2).join('.') 
            } else {
                domain = '.alol.io'
            }
            
            for (var stateKey in state) {
                stateItem = state[stateKey];
                cookies.set(stateKey, stateItem[0], {domain: domain, httpOnly: true, expires: new Date(stateItem[1]*1000)})
            }
        } catch (e) {
            blog.error(e);
        }
        
        res.writeHead(code, head);
        
        if (backendRequest.body.method !== 'OPTIONS' && backendRequest.body.method !== 'HEAD') {
            if (typeof body != 'string') {
                body.p_time = processing ;
                res.write(JSON.stringify(body));
            } else {
                res.write(body);
            }
        }
        
        res.end();
        
        this.process.delete(uid);
    }
};

var AmqpCloudPublisher = {
    /* amqp connection meta */
    host         : '',
    queue        : '',
    
    /* amqp state and objects */
    context      : {},
    publisher    : {},
    queueReady   : false,
    
    /* publish items queue */
    requestsQueue: [],

    logger : {},
    log : function (data) {
        this.logger.log(data);
    },

    /* init publisher */
    init: function (host, queue, cloud) {
        var self = this;
        self.host = host;
        self.queue = queue.toLowerCase();
        self.logger = Object.create(blog);
        self.logger.prefix = 'Publisher ' + cloud;
        self.initContext();
    },

    initContext : function () {
        var self = this;

        self.log('initContext');
        self.context = rabbit.createContext(self.host, {persistent : true});
        
        var ctxtUuid = uuid.v4();
        self.context.uuid = ctxtUuid;

        self.context.on('ready', self.onInit.bind(self));
        self.context.on('error', function() {
            self.onConnectionError(ctxtUuid);
        });
    },

    onConnectionError : function(uuid) {
        var self = this;
        this.log('onConnectionError: ' + uuid + ' to ' + this.host);

        if (this.context.uuid == uuid && !self.reconnecting) {
            self.reconnecting = setTimeout(function () {
                self.reconnecting = false;
                self.initContext();
            }, 500);
        }
    },

    onInit: function () {
        var self = this;
        this.log('socket ready at: ' + self.host);
        self.publisher = self.context.socket('PUSH');
        self.connect();
    },

    add: function (backendRequest) {
        if (this.queueReady) {
            this.log("Sent request: " + backendRequest.uid);
            backendRequest.addTrace('AmqpCloudPublisher add');
            this.publisher.write(backendProtocol.pack(backendRequest), 'utf8');    
        } else {
            this.log("Postpone request: " + backendRequest.uid);
            this.requestsQueue.push(backendRequest);      
        }
    },

    reconnect: function (e) {
        var self = this;
        self.log('reconnect case: ' + e);

        self.queueReady = false;
        try  {
            self.reader.close();
        } catch (e){
            self.log('connection close error: ' + e.errno);
        }

        this.connect();
    },
    
    connect: function () {
        var self = this;
        
        try  {
            // sub.pipe(process.stdout);
            this.publisher.connect(self.queue, function () {
                self.log("ready on queue: " + self.queue);
                self.publisher.on('close', self.reconnect.bind(self));
                self.publisher.on('error', self.reconnect.bind(self));
                self.queueReady = true;
                self.processQueue();
            });

            self.publisher.on('error', self.reconnect.bind(self));
        } catch (e) {
            this.log("AmqpCloudPublisher: Error on connect: " + e.message);
            setTimeout(self.reconnect.bind(self), 500);
        }
    },
    processQueue : function () {
        while (this.requestsQueue.length && this.queueReady) {
            var req = this.requestsQueue.pop();
            this.add(req);
        }
    }
};

var AmqpCloudResultReader = {
    /* amqp connection meta */
    host         : '',
    queue        : '',

    /* amqp state and objects */
    context      : null,
    currentUuid : '',
    reader    : {},
    queueReady   : false,
    reconnecting : false,
    logger : {},
    log : function (data) {
        this.logger.log(data);
    },
    /* init reader */
    init: function (host, queue) {
        var self = this;
        self.host = host;
        self.queue = queue.toLowerCase();
        self.logger = Object.create(blog);
        self.logger.prefix = 'Reader';
        self.initContext();
    },
    
    initContext : function () {
        var self = this;
        
        self.log('initContext');
        self.context = rabbit.createContext(self.host, {durable: true, routing: 'direct'});
        
        var ctxtUuid = uuid.v4();
        self.context.uuid = ctxtUuid;
        
        self.context.on('ready', self.onInit.bind(self));
        self.context.on('error', function() {
            self.onConnectionError(ctxtUuid);
        });
        
    },

    onInit: function () {
        var self = this;
        this.log('socket ready at: ' + self.host);
        
        self.reader = self.context.socket('PULL', {prefetch: 1});
        self.reader.setEncoding('utf8');
        
        self.connect();
    },

    onData: function (dataJson) {
        var self = this;
        try {
            var data = JSON.parse(dataJson);
            self.log('Read response: ' + data.uid + ' from ' + data.from);
            Requests.writeResponse(data.uid, data.code, data.head, data.body, data.state || {});    
        } catch (e) {
            self.log('Error write response: ' + dataJson + ', error: ' + e);
        }
    },
    onConnectionError : function(uuid) {
        var self = this;
        this.log('onConnectionError: ' + uuid);
        
        if (this.context.uuid == uuid && !self.reconnecting) {
            self.reconnecting = setTimeout(function () {
                self.reconnecting = false;
                self.initContext();
            }, 500);
        }
    },
    reconnect: function (e) {
        var self = this;
        self.log('reconnect case: ' + e);
        
        self.queueReady = false;
        try  {
            self.reader.close();    
        } catch (e){
            self.log('connection closed: ' + e);
        }
        
        this.connect();
    },

    connect: function () {
        var self = this;
        
        try  {
            self.reader.connect(self.queue, function () {
                self.log("ready on queue: " + self.queue);
                self.reader.on('close', self.reconnect.bind(self));
                self.reader.on('data', self.onData.bind(self));
                self.reader.on('error', self.reconnect.bind(self));
                self.queueReady = true;
            });
        } catch (e) {
            self.log("Error on connect: " + e.message);
            setTimeout(self.reconnect.bind(self), 500);
        }
    }
};

// io.on('connection', function (socket) {
//     socket.emit('news', { hello: 'world' });
//     socket.on('my other event', function (data) {
//         console.log(data);
//     });
// });

blog.showDebugLogs = true;

Requests.init();
HttpHandler.init();

for (var cloudName in Haven.routes) {
    Haven.getCloud(cloudName);
}

AmqpCloudResultReader.init('amqp://' + identity.amqpHost, identity.ns + '.' + identity.getNodeId());

app.listen(9080);