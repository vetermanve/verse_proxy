var url = require("url");
var Cookies = require( "cookies" );
var http = require('http');
var backendProtocol = require('./restRequest.js');

/**
 * Main Http consumer
 *
 * @type {{handle: HttpHandler.handle}}
 */
var HttpHandler = {
    logger : {},
    routes : {},
    processing : null,
    server : {},
    port : 8090,
    log : function (data) {
        this.logger.log(data);
    },
    init : function (logger, processing, port, routes) {
        this.logger = logger;
        this.logger.prefix = 'HttpHandler';
        
        this.processing = processing;
        this.routes = routes || {};
        this.port = port || this.port;
        var self = this;
        this.server = http.createServer(function handler(req, res) { self.handle(req, res); });
    },
    start : function () {
        var self = this;
        this.server.listen(self.port, function () {
            self.log("http server started on port: " + self.port);
        });  
    },
    handle: function (httpRequest, httpResult) {
        var urlData = url.parse(httpRequest.url);

        if (urlData.pathname === '/favicon.ico') {
            httpResult.writeHead(404);
            httpResult.end();
            return;
        }
        
        if (typeof this.routes[urlData.pathname] !== 'undefined') {
            try {
                var call = this.routes[urlData.pathname];
                var data = call();

                httpResult.writeHead(200);
                httpResult.write(data);
                httpResult.end();
                
            } catch (e) {
                httpResult.writeHead(500);
                httpResult.write("Some error here.");
                httpResult.end();
            }
        }


        var method = httpRequest.method;

        var backendRequest = backendProtocol.buildRequestObj(httpRequest.method, urlData.pathname, urlData.query);
        backendRequest.resultStream = httpResult;
        backendRequest.request = httpRequest;
        backendRequest.cookies = new Cookies(backendRequest.request, backendRequest.resultStream);
        backendRequest.body.headers= httpRequest.headers;
        
        // this.log(backendRequest.body);
        this.log('Incoming request ' + backendRequest.uid + ' ' + backendRequest.body.method + ' ' + backendRequest.body.path);

        if (method === 'POST' || method === 'PUT') {
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
        try {
            var call = this.processing;
            call(backendRequest);
        } catch (e) {
            try  {
                this.logger("Error on Http processing: " + e.message);
                var httpResult = backendRequest.resultStream;
                httpResult.writeHead(500);
                httpResult.write("Some error here. " + e.message);
                httpResult.end();    
            } catch (el) {
                this.logger("Crazy error on Http processing: " + el.message);
            }
        }
        
        backendRequest.setData('cleared');
    },
    writeResponse : function (backendRequest, uid, code, head, body, state) {
        var res = backendRequest.resultStream;
        backendRequest.addTrace('Requests writeResponse');

        var processing = (Date.now() - backendRequest.born) / 1000;
        
        var cookies = backendRequest.cookies;

        try {
            var stateItem;
            var origin = backendRequest.request.headers['origin'] || '';
            var domain = url.parse(origin).hostname;

            domain = domain.split('.').slice(-2).join('.'); // TODO move cookie domain calculation anywhere 
            
            for (var stateKey in state) {
                stateItem = state[stateKey];
                cookies.set(stateKey, stateItem[0], {domain: domain, httpOnly: true, expires: new Date(stateItem[1]*1000)})
            }
        } catch (e) {
            this.logger.error(e);
        }
        
        head = head || [];
        head.push("x-proxy-full-time: " + processing);

        res.writeHead(code, head);

        if (backendRequest.body.method !== 'OPTIONS' && backendRequest.body.method !== 'HEAD') {
            if (typeof body === 'object') {
                res.write(JSON.stringify(body));
            } else {
                res.write(body);
            }
        }

        res.end();

        this.process.delete(uid);
    }
};

exports.create = function (logger, porcessing) {
    HttpHandler.init(logger, porcessing);
    return HttpHandler;
};