let HttpRequestSource = require("./request/channel/http_source");
let Logger = require("./logger/logger");

Logger.setPrefixMaxLen(18);

let logger = new Logger("Core");
logger.log("This is a start!");

/**
 * 
 * @param clientRequest ClientRequest 
 */
let processing = function (clientRequest) {
      console.log(clientRequest);
      throw new Error("Just stop");
};

let server = new HttpRequestSource(processing);

server.logger = new Logger("HttpRequestChannel");
server.init();

server.start();