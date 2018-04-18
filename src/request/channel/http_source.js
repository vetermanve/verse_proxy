const AbstractRequestSource = require("./source_proto");
const http = require("http");
const url = require("url");
const Cookie = require( "cookie");
const Request = require("../client_request");

class HttpRequestChannel extends AbstractRequestSource {
     
    constructor (processing, port, routes) {
        super();
        this.processing = processing;
        this.routes = routes || {};
        this.port = port || 9080;
        this.server = {};
    }
    init() {
        this.logger.log("Init");
        let self = this;
        this.server = http.createServer(function handler(req, res) { self.handle(req, res); });
        return super.init();
    }
    
    start() {
        let self = this;
        this.logger.log("Start");
        this.server.listen(self.port, function () {
            self.logger.log("Http server started on port: " + self.port);
        });
        
        super.start();
    }
    // handle(req, res) {
    //     this.logger.log(req);
    //     this.logger.log(res);
    //     res.writeHead(200);
    //     res.end();
    //    
    //    
    // }
    handle (httpRequest, httpResult) {
        const self = this;
        const urlData = url.parse(httpRequest.url);

        if (urlData.pathname === '/favicon.ico') {
            httpResult.writeHead(404);
            httpResult.end();
            return;
        }

        if (typeof this.routes[urlData.pathname] !== 'undefined') {
            try {
                let call = this.routes[urlData.pathname];
                let data = call();

                httpResult.writeHead(200);
                httpResult.write(data);
                httpResult.end();

            } catch (e) {
                httpResult.writeHead(500);
                httpResult.write("Some error here.");
                httpResult.end();
            }
        }

        
        let cookies = Cookie.parse(httpRequest.headers.cookie || '');
        let clientRequest = new Request(null, httpRequest.method, urlData.pathname, urlData.query, '', httpRequest.headers, cookies);
        self.logger.debug(clientRequest);

        let requestBody = [];
        
        /* Bind on request events */
        httpRequest.on('data', function(chunk) {
            requestBody.push(chunk);
        }).on('end', function() {
            clientRequest.data = Buffer.concat(requestBody).toString();
            self.process(clientRequest, httpResult);
        }).on('error', function (error) {
            self.logger.error('httpRequest error on catchBody', error);
            // Requests.clearRequest(restRequest.uid, );
        });
    }
    process (backendRequest, httpResult) {
        try {
            let call = this.processing;
            call(backendRequest);
        } catch (e) {
            try  {
                this.logger.warn("Error on Http processing: " + e.message);
                httpResult.writeHead(500);
                httpResult.write("Some error here. " + e.message);
                httpResult.end();
            } catch (el) {
                this.logger.error("Crazy error on Http processing: " + el.message);
            }
        }
    }
    writeResponse (backendRequest, uid, code, head, body, state) {
        let res = backendRequest.resultStream;
        backendRequest.addTrace('Requests writeResponse');

        let processing = (Date.now() - backendRequest.born) / 1000;

        let cookies = backendRequest.cookies;

        try {
            let stateItem;
            let origin = backendRequest.request.headers['origin'] || '';
            let domain = url.parse(origin).hostname;

            domain = domain.split('.').slice(-2).join('.'); // TODO move cookie domain calculation anywhere 

            for (let stateKey in state) {
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
}

module.exports = HttpRequestChannel;