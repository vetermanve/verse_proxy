let HttpRequestSource = require("./client_side/channel/http_source");
let Logger = require("./logger/logger");

let Response = require("./client_side/model/client_response"); 

Logger.setPrefixMaxLen(18);

let logger = new Logger("Core");
logger.log("This is a start!");

/**
 *
 * @param clientRequest ClientRequest
 * @param writeBack
 */
function processing(clientRequest, writeBack) {
    let response = new Response(200, "<h1>Hello Proxy " + clientRequest.path + "!</h1>", {"content-type" : "text/html"});
    writeBack(response);
}


let server = new HttpRequestSource();
server.logger = new Logger("HttpRequestChannel", true);
server.processing = processing;

server.init();
server.start();