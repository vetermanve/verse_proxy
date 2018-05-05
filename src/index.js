const HttpRequestSource = require("./client_side/channel/HttpRequestChannel");
const SocketSource = require("./client_side/channel/SocketSource");
const Logger = require("./logger/Logger");

const StackHandler = require('./server_side/handler/StackHandler');
const FileHandler = require('./server_side/handler/FileHandler');
const ServerChanelHandler = require('./server_side/handler/ServerChannelHandler');

const NotFoundHandler = require('./server_side/handler/NotFoundHandler');
const RabbitChannel = require('./server_side/channel/RabbitMqChannel');
const config = require('./env/config');

// Global logger configuration
Logger.setPrefixMaxLen(18);

// Set-up core logger
let logger = new Logger("Core");
logger.log("This is a start!");

let rabbitChannel = new RabbitChannel('amqp://' + config.amqpHost, config.getPublishQueue(), config.getResultQueue());
rabbitChannel.logger = new Logger("RabbitServerChannel", true);
let rabbitHandler = new ServerChanelHandler();
rabbitHandler.channel = rabbitChannel;


let handler = new StackHandler();
handler.addHandler(new FileHandler(__dirname + '/../public'));
handler.addHandler(new FileHandler('/macdata/projects/mutants/reanima-back/public'));

handler.addHandler(rabbitHandler);
handler.addHandler(new NotFoundHandler());

let processing = function (clientRequest, writeBack) {
    handler.handle(clientRequest, writeBack);
};

rabbitChannel.init();
rabbitChannel.start();

// Create server
let server = new HttpRequestSource(processing, 9080);
server.logger = new Logger("HttpRequestChannel", false);
server.init();
server.start();

let socketServer = new SocketSource(processing, 9081);
socketServer.logger = new Logger("SocketChannel", true);
socketServer.init();
socketServer.start();

