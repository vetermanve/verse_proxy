var app = require('http').createServer(handler);
var io = require('socket.io')(app);
var fs = require('fs');
var url = require("url");
var amqp = require("amqplib");
var uuid = require("node-uuid");
var rabbit = require('rabbit.js');

var RestRequest = function (uid, method, path, query) {
    this.uid = uid;
    this.path = path;
    this.method = method;
    this.query = query || '';
};

var Requests = {
    timing : {},
    process  : {}, register: function (res) {
        var uid = this.getUid();
        this.process[uid] = {result: res, time: Date.now()};
        res.on('close', this.clearRequest.bind(this));
        res.on('error', function () {
            console.error('Requests: error on http request ' + JSON.stringify(arguments));
        });
        return uid;
    }, 
    clearRequest : function () {
        console.warn('Http request closed ' + JSON.stringify(arguments));
    },
    getUid: function () {
        return uuid.v4();
    }, 
    write : function (uid, code, head, body) {
        var reqData = this.process[uid];
        var res = reqData.result;
        
        if (typeof res == 'undefined') {
            console.warn('uid result object not found. Body skip');
            return false;
        }

        var timeId = Math.floor(Date.now()/1000);
        var exTime = (Date.now() - reqData.time)/1000;
        
        var tLog = {};
        
        if (typeof this.timing[timeId] == 'undefined') {
            console.log(this.timing);
            this.timing[timeId] = tLog = {
                cnt : 0,
                avg : 0,
                time : 0
            };
        } else {
            tLog = this.timing[timeId]; 
        }

        tLog.cnt++;
        tLog.time += exTime; 
        tLog.avg = Math.round((tLog.time / tLog.cnt * 10000))/10000;
        
        // console.log('Writing response to # ' + uid + ' catched by time ' + exTime);
        
        res.writeHead(code);
        res.write(body);
        res.end();
        
        delete this.process[uid];
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

        var uid = Requests.register(res);
        var restRequest = new RestRequest(uid, req.method, urlData.pathname, urlData.query);
        // console.log('Start processing: ' + JSON.stringify(restRequest));

        AmqpCloudPublisher.add(restRequest);
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

        self.context = rabbit.createContext(self.host);
        self.context.on('ready', self.onInit.bind(self));
    },

    onInit: function () {
        var self = this;
        console.log('AmqpCloudPublisher socket ready on host: ' + self.host);
        self.publisher = self.context.socket('PUB');
        self.connect();        
    },

    add: function (data) {
        if (this.queueReady) {
            this.publisher.write(JSON.stringify(data), 'utf8');    
        } else {
            this.requestsQueue.push(data);      
        }
    },

    reconnect: function () {
        var self = this;
        console.log('AmqpCloudPublisher reconnect');
        self.queueReady = false;
        self.publisher.close();
        self.connect();
    },
    
    connect: function () {
        var self = this;
        
        // sub.pipe(process.stdout);
        self.publisher.connect(self.exchange, function () {
            console.log("AmqpCloudPublisher publish queue ready");
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

        self.context = rabbit.createContext(self.host);
        self.context.on('ready', self.onInit.bind(self));
    },

    onInit: function () {
        var self = this;
        console.log('AmqpCloudResultReader socket ready on host: ' + self.host);
        self.reader = self.context.socket('SUB');
        self.connect();
    },

    onData: function (dataJson) {
        var data = JSON.parse(dataJson);
        
        var uid = data.uid,
            code = data.code,
            head = data.head,
            body = data.body
        ;
        
        Requests.write(uid, code, head, body);
    },

    reconnect: function () {
        var self = this;
        console.log('AmqpCloudResultReader reconnect');
        self.queueReady = false;
        self.reader.close();
        self.connect();
    },

    connect: function () {
        var self = this;

        self.reader.connect(self.exchange, function () {
            console.log("AmqpCloudResultReader read queue ready");
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

var context = rabbit.createContext('amqp://dev.alol.io');
context.on('ready', function() {
    var pub = context.socket('PUB'), 
        sub = context.socket('SUB')
    ;
    
    // sub.pipe(process.stdout);
    
    sub.connect('bpass.client_requests', function() {
        console.log('Fake worker listener bpass.client_requests ready');
    });
    
    var pubReady = false;
    pub.connect('bpass.client_answers', function() {
        pubReady = true;
        console.log('Fake worker listener bpass.client_answers ready');
    });
    
    var fakeAnswer = function (dataJson) {
        var data = JSON.parse(dataJson);
        
        // console.log('fakeAnswer: get data ' + dataJson);
        
        if (typeof data == 'undefined') {
            console.log('fakeAnswer skip undefined data ');    
            return ;
        }
        
        var bind = {
            code : 200,
            uid : data.uid,
            body : 'The context will emit "ready" when it\'s connected.',
            head : []
        };
        
        if (pubReady) {
            pub.write(JSON.stringify(bind), 'utf8');    
        } else {
            console.log("fakeAnswer: publish not ready");
        }
    };

    sub.on('data', fakeAnswer);
});

AmqpCloudPublisher.init('amqp://dev.alol.io', 'bpass.client_requests', '');
AmqpCloudResultReader.init('amqp://dev.alol.io', 'bpass.client_answers', '');

app.listen(8080);