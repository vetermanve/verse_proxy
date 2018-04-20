const HttpRequestSource = require("./client_side/channel/http_source");
const Logger = require("./logger/logger");

const StackHandler = require('./server_side/handler/stack_handler');
const FileHandler = require('./server_side/handler/file_handler');
const NotFoundHandler = require('./server_side/handler/notfound_handler');

// Global logger configuration
Logger.setPrefixMaxLen(18);

// Set-up core logger
let logger = new Logger("Core");
logger.log("This is a start!");

// Create server
let server = new HttpRequestSource();
server.logger = new Logger("HttpRequestChannel", true);

// Create handler
let handler = new StackHandler();
handler.addHandler(new FileHandler(__dirname + '/../public'));
handler.addHandler(new NotFoundHandler());

// Bind handler
server.processing = function (clientRequest, writeBack) {
    handler.handle(clientRequest, writeBack);
};

// Init server
server.init();

// Start server
server.start();