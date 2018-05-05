const AbstractRequestSource = require("./AbstractRequestSource");
const http = require("http");
const url = require("url");
const Cookie = require( "cookie");
const Request = require("../model/ClientRequest");
const Response = require("../model/ClientResponse");

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
        let clientRequest = new Request(null, httpRequest.method, urlData.pathname, urlData.query, '', httpRequest.headers, cookies);
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

        let cookies = '';
        
        for (let key in response.state) {
            cookies += Cookie.serialize(key, response.state[key][0], {
                httpOnly: true,
                expires: new Date(response.state[key][1] * 1000),
                path : '/'
            }) + ";";    
        }
        
        if (request) {
            response.headers["x-process-full-time"] = (Date.now()/1000 - request.born).toFixed(4);
        }
        
        if (cookies) {
            response.headers['set-cookie'] = cookies;    
        }
        
        this.logger.debug(response);
        
        // write heads
        stream.writeHead(response.code, response.headers);
        
        if (typeof response.data === 'object') {
            stream.write(JSON.stringify(response.data));
        } else {
            stream.write(response.data);
        }
        
        stream.end();
    }
}

module.exports = HttpRequestChannel;