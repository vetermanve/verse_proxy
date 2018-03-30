var identity = require('./modules/identity.js').identity;

var blog = require("./modules/blog").init(identity.getNodeId());
var ReqPerformance = require("./modules/performance.js");
var httpHandlerCreate = require('./modules/httpHandler.js').create;
// var HashTable = require('hashtable');

var AmqpCloudPublisherCreate = require("./modules/amqpRabbitChannel").publisher;
var AmqpCloudReaderCreate = require("./modules/amqpRabbitChannel").reader;

var Haven = {
    routes : {
        'all' : 20
    },
    clouds : {},
    reader : {},
    init : function (identity) {
        for (var routeName in this.routes) {
            this.getCloud(routeName, identity);
        }
        
        this.getReader(identity);
    },
    getCloud : function(name, identity) {
        if (!this.clouds[name]) {
            this.clouds[name] =  AmqpCloudPublisherCreate('amqp://' + identity.amqpHost, identity.getPublishQueue(name), name, blog);
        }
        
        return this.clouds[name];
    },
    getReader : function (identity) {
        if (!this.reader) {
            this.reader = AmqpCloudReaderCreate('amqp://' + identity.amqpHost, identity.getResultQueue(), blog);    
        }
        
        return this.reader;
    }
};

// if (urlData.pathname === '/node-status') {
//     httpResult.writeHead(200);
//     httpResult.write(JSON.stringify(ReqPerformance.logs));
//     httpResult.end();
//    
//     return;
// }

var Requests = {
    timing : [],
    logId : [],
    process : {},
    init : function () {
        this.process = new Map();  
    },
    has : function () {
       return this.process.has(uid); 
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

        if (typeof backendRequest === 'undefined') {
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
            var origin = backendRequest.request.headers['origin'] || '';
            var domain = url.parse(origin).hostname;
            
            domain = domain.split('.').slice(-2).join('.'); 
            
            for (var stateKey in state) {
                stateItem = state[stateKey];
                cookies.set(stateKey, stateItem[0], {domain: domain, httpOnly: true, expires: new Date(stateItem[1]*1000)})
            }
        } catch (e) {
            blog.error(e);
        }
        
        res.writeHead(code, head);
        
        if (backendRequest.body.method !== 'OPTIONS' && backendRequest.body.method !== 'HEAD') {
            if (typeof body === 'object') {
                try  {
                    body.p_time = processing;    
                } catch (e) {}
                res.write(JSON.stringify(body));
            } else {
                res.write(body);
            }
        }
        
        res.end();
        
        this.process.delete(uid);
    }
};

blog.showDebugLogs = true;

var HttpHandler = httpHandlerCreate(blog, function (data) {
    console.log("Http requested");
});

Haven.init(identity);
Requests.init();
HttpHandler.start();