const HttpRequestSource = require("./client_side/channel/http_source");
const SocketSource = require("./client_side/channel/socketio_source");
const Logger = require("./logger/logger");

const StackHandler = require('./server_side/handler/stack_handler');
const FileHandler = require('./server_side/handler/file_handler');
const NotFoundHandler = require('./server_side/handler/notfound_handler');

// Global logger configuration
Logger.setPrefixMaxLen(18);

// Set-up core logger
let logger = new Logger("Core");
logger.log("This is a start!");

let handler = new StackHandler();
handler.addHandler(new FileHandler(__dirname + '/../public'));
handler.addHandler(new NotFoundHandler());

let processing = function (clientRequest, writeBack) {
    handler.handle(clientRequest, writeBack);
};

// Create server
let server = new HttpRequestSource(processing, 9080);
server.logger = new Logger("HttpRequestChannel", false);
server.init();
server.start();

let socketServer = new SocketSource(processing, 9081);
socketServer.logger = new Logger("SocketChannel", true);
socketServer.init();
socketServer.start();

