var app = require('http').createServer(handler);
var io = require('socket.io')(app);
var fs = require('fs');
var url = require("url");
var amqp = require("amqplib");
var uuid = require("node-uuid");
var rabbit = require('rabbit.js');
var identity = require('./modules/identity.js').identity;
var restRequest = require('./modules/restRequest.js');

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
    register: function (res, request) {
        this.process.set(request.uid, {result: res, request: request, time: Date.now()});
        res.on('close', this.clearRequest.bind(this));
        res.on('error', function () {
            blog.error('Requests: error on http request ' + JSON.stringify(arguments));
        });
    }, 
    clearRequest : function () {
        blog.warn('Http request closed ' + JSON.stringify(arguments));
    },
    writeResponse : function (uid, code, head, body) {
        var reqData = this.process.get(uid);
        
        if (typeof reqData == 'undefined') {
            blog.warn('uid ' + uid +' result object not found. Body skip');
            return false;
        } else {
            
        }
        
        var res = reqData.result;
        reqData.request.addTrace('Requests writeResponse');
        
        var exTime = (Date.now() - reqData.time)/1000;
        ReqPerformance.add(exTime);
        
        blog.log(reqData.request.trace);
        
        // console.log('Writing response to # ' + uid + ' catched by time ' + exTime);
        
        res.writeHead(code);
        res.write(body);
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
    handle: function (req, res) {
        var urlData = url.parse(req.url);
        if (urlData.pathname == '/favicon.ico') {
            res.writeHead(404);
            res.end();
            return;
        }

        if (urlData.pathname == '/node-status') {
            res.writeHead(200);
            res.write(JSON.stringify(ReqPerformance.logs));
            res.end();
            return;
        }

        var request = restRequest.build(uuid.v4(), req.method, urlData.pathname, urlData.query, identity.getResultQueue());
        // console.log('Start processing: ' + JSON.stringify(request));

        var uid = Requests.register(res, request);
        AmqpCloudPublisher.add(request);
        // res.write(AmqpCloudPublisher.host);
        // res.end();
    }
};

function handler(req, res) {
    HttpHandler.handle(req, res);
}

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
    },

    onInit: function () {
        var self = this;
        blog.log('AmqpCloudPublisher socket ready on host: ' + self.exchange + '@' + self.host);
        self.publisher = self.context.socket('PUSH');
        self.connect();
    },

    add: function (request) {
        if (this.queueReady) {
            blog.log("Sent request " + request.uid);
            request.addTrace('AmqpCloudPublisher add');
            this.publisher.write(JSON.stringify(request), 'utf8');    
        } else {
            this.requestsQueue.push(request);      
        }
    },

    reconnect: function () {
        var self = this;
        blog.log('AmqpCloudPublisher reconnect');
        self.queueReady = false;
        self.publisher.close();
        self.connect();
    },
    
    connect: function () {
        var self = this;
        
        // sub.pipe(process.stdout);
        self.publisher.connect(self.exchange, function () {
            blog.log("AmqpCloudPublisher publish queue ready on " + self.exchange);
            self.publisher.on('close', function () {self.reconnect()});
            self.queueReady = true;
            self.processQueue();
        });
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

Requests.init();
AmqpCloudPublisher.init('amqp://localhost', publishQueue, '');
AmqpCloudResultReader.init('amqp://localhost', resultQueue, '');

app.listen(9080);