const AbstractRequestSource = require("./source_proto");
const http = require("http");
const url = require("url");
const Cookie = require( "cookie");
const Request = require("../model/client_request");
const Response = require("../model/client_response");

class HttpRequestChannel extends AbstractRequestSource {
    
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
    handle (httpRequest, httpResult) {
        const self = this;
        const urlData = url.parse(httpRequest.url);
        
        let cookies = Cookie.parse(httpRequest.headers.cookie || '');
        let clientRequest = new Request(null, httpRequest.method, urlData.path, urlData.query, '', httpRequest.headers, cookies);
        self.logger.debug(clientRequest);

        let requestBody = [];
        
        const writeBack = function (response) {
            self.response(response, httpResult, clientRequest);  
        };
        
        /* Bind on request events */
        httpRequest.on('data', function(chunk) {
            requestBody.push(chunk);
        }).on('end', function() {
            clientRequest.data = Buffer.concat(requestBody).toString();
            self.process(clientRequest, writeBack);
        }).on('error', function (error) {
            self.logger.error('httpRequest error on catchBody', error);
            // Requests.clearRequest(restRequest.uid, );
        });
    }
    process (request, writeBack) {
        try {
            let call = this.processing;
            call(request, writeBack);
        } catch (e) {
            try  {
                writeBack(new Response(500, "Some error here: " + e.message + "\n"));
            } catch (el) {
                this.logger.error("Crazy error on Http processing: " + el.message);
            }
        }
    }
    response (response, stream, request) {
        response = response || new Response(500, "Response missing");
        
        if (request) {
            response.headers["x-process-full-time"] = (Date.now()/1000 - request.born).toFixed(4);    
        }
        
        this.logger.log(response);
        
        // write heads
        stream.writeHead(response.code, response.headers);
        
        if (typeof response.data === 'object') {
            stream.write(JSON.stringify(response.data));
        } else {
            stream.write(response.data);
        }
        
        stream.end();
    }
    // cookieParsing (backendRequest, uid, code, head, body, state) {
    //     let cookies = backendRequest.cookies;
    //
    //     try {
    //         let stateItem;
    //         let origin = backendRequest.request.headers['origin'] || '';
    //         let domain = url.parse(origin).hostname;
    //
    //         domain = domain.split('.').slice(-2).join('.'); // TODO move cookie domain calculation anywhere 
    //
    //         for (let stateKey in state) {
    //             stateItem = state[stateKey];
    //             cookies.set(stateKey, stateItem[0], {domain: domain, httpOnly: true, expires: new Date(stateItem[1]*1000)})
    //         }
    //     } catch (e) {
    //         this.logger.error(e);
    //     }
    //
    //     this.process.delete(uid);
    // }
}

module.exports = HttpRequestChannel;