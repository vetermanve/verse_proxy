var app = require('http').createServer(function handler(req, res) { HttpHandler.handle(req, res); });
var io = require('socket.io')(app);
var fs = require('fs');
var url = require("url");
var rabbit = require('rabbit.js');
var identity = require('./modules/identity.js').identity;
var backendProtocol = require('./modules/restRequest.js');

// var HashTable = require('hashtable');

var blog = {
    prefix : null,
    log : function (info, warn ) {
        warn = warn || false;
        if (!this.prefix) {
            this.prefix = identity.getNodeId()       
        }
        info = this.prefix + '> ' + (typeof info != 'string' ? JSON.stringify(info, null, 4) : info);
        
        if (warn) {
            console.warn(info);
        } else {
            console.log(info);    
        }
    },
    warn : function (info) {
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
                blog.log(this.logs);
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
    writeResponse : function (uid, code, head, body) {
        var backendRequest = this.process.get(uid);
        
        if (typeof backendRequest == 'undefined') {
            blog.warn('uid ' + uid +' result object not found. Body skip');
            return false;
        }
        
        var res = backendRequest.resultStream;
        backendRequest.addTrace('Requests writeResponse');
        
        ReqPerformance.add((Date.now() - backendRequest.born)/1000);
        
        // blog.log(backendRequest.trace);
        
        res.writeHead(code, head);
        if (typeof body != 'string') {
            res.write(JSON.stringify(body));    
        } else {
            res.write(body);
        }
        
        res.end();
        
        this.process.delete(uid);
    }
};

/**
 * Main Http consumer
 *
 * @type {{handle: HttpHandler.handle}}
 */
var HttpHandler = {
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
        
        Requests.register(backendRequest);
        
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
        AmqpCloudPublisher.add(backendRequest);
        backendRequest.setData('cleared');
    }
};

var AmqpCloudPublisher = {
    /* amqp connection meta */
    host         : '',
    exchange     : '',
    queue        : [],
    
    /* amqp state and objects */
    context      : {},
    publisher    : {},
    queueReady   : false,
    
    /* publish items queue */
    requestsQueue: [],

    /* init publisher */
    init: function (host, exchange, queue) {
        var self = this;
        self.host = host;
        self.exchange = exchange;
        self.queue = queue;

        self.context = rabbit.createContext(self.host, {persistent : true});
        self.context.on('ready', self.onInit.bind(self));
        self.context.on('error', self.reconnect.bind(self));
    },

    onInit: function () {
        var self = this;
        blog.log('AmqpCloudPublisher socket ready on host: ' + self.exchange + '@' + self.host);
        self.publisher = self.context.socket('PUSH');
        self.connect();
    },

    add: function (backendRequest) {
        if (this.queueReady) {
            blog.log("Sent request " + backendRequest.uid);
            backendRequest.addTrace('AmqpCloudPublisher add');
            this.publisher.write(backendProtocol.pack(backendRequest), 'utf8');    
        } else {
            this.requestsQueue.push(backendRequest);      
        }
    },

    reconnect: function () {
        var self = this;
        blog.log('AmqpCloudPublisher reconnect');
        self.queueReady = false;
        try {
            self.publisher.close();    
        } catch (e) {
            blog.log('On reconnect: ' + e.message + ", type: " + e.name);
        }
        
        self.connect();
    },
    
    connect: function () {
        var self = this;
        
        // sub.pipe(process.stdout);
        self.publisher.connect(self.exchange, function () {
            blog.log("AmqpCloudPublisher publish queue ready on " + self.exchange);
            self.publisher.on('close', self.reconnect.bind(self));
            self.publisher.on('error', self.reconnect.bind(self));
            self.queueReady = true;
            self.processQueue();
        });
        
        self.publisher.on('error', self.reconnect.bind(self));
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
    exchange     : '',
    queue        : [],

    /* amqp state and objects */
    context      : {},
    reader    : {},
    queueReady   : false,

    /* init reader */
    init: function (host, exchange, queue) {
        var self = this;
        self.host = host;
        self.exchange = exchange;
        self.queue = queue;

        self.context = rabbit.createContext(self.host, {durable: true, routing: 'direct'});
        self.context.on('ready', self.onInit.bind(self));
        self.context.on('error', self.reconnect.bind(self));
    },

    onInit: function () {
        var self = this;
        blog.log('AmqpCloudResultReader socket ready on host: '+ self.exchange + '@' + self.host);
        self.reader = self.context.socket('PULL', {prefetch: 1});
        self.reader.setEncoding('utf8');
        self.connect();
    },

    onData: function (dataJson) {
        var data = JSON.parse(dataJson);
        
        var uid = data.uid,
            code = data.code,
            head = data.head,
            body = data.body
        ;
        
        Requests.writeResponse(uid, code, head, body);
    },

    reconnect: function () {
        var self = this;
        blog.log('AmqpCloudResultReader reconnect');
        self.queueReady = false;
        self.reader.close();
        self.connect();
    },

    connect: function () {
        var self = this;

        self.reader.connect(self.exchange, function () {
            blog.log("AmqpCloudResultReader read queue ready");
            self.reader.on('close', self.reconnect.bind(self));
            self.reader.on('data', self.onData.bind(self));
            self.reader.on('error', self.reconnect.bind(self));
            self.queueReady = true;
        });
    }
};

// io.on('connection', function (socket) {
//     socket.emit('news', { hello: 'world' });
//     socket.on('my other event', function (data) {
//         console.log(data);
//     });
// });

var publishQueue = identity.getPublishQueue();
var resultQueue = identity.ns + '.' + identity.getNodeId();
var amqpHost = 'localhost';
// var amqpHost = 'dev.alol.io';

Requests.init();
AmqpCloudPublisher.init('amqp://' + amqpHost, publishQueue, '');
AmqpCloudResultReader.init('amqp://' + amqpHost, resultQueue, '');

app.listen(9080);