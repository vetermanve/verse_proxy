const HttpRequestSource = require("./client_side/channel/HttpRequestChannel");
const SocketSource = require("./client_side/channel/SocketSource");
const Logger = require("./logger/Logger");

const StackHandler = require('./server_side/handler/StackHandler');
const FileHandler = require('./server_side/handler/FileHandler');
const ServerChanelHandler = require('./server_side/handler/ServerChannelHandler');

const NotFoundHandler = require('./server_side/handler/NotFoundHandler');
const AmqpRequestChannel = require('./server_side/channel/AmqpRequestChannel');
const AmqpSubscribeChannel = require('./server_side/channel/AmqpSubscriptionChannel');
const config = require('./env/config');

// Global logger configuration
Logger.setPrefixMaxLen(18);

// Set-up core logger
let logger = new Logger("Core");
logger.log("This is a start!");

let amqpRequestHendler = new ServerChanelHandler();

// let amqpRequest = new AmqpRequestChannel('amqp://' + config.amqpHost, config.getPublishQueue(), config.getResultQueue());
// amqpRequest.logger = new Logger("RabbitServerChannel", true);
// amqpRequestHendler.channel = amqpRequest;
// amqpRequest.init();
// amqpRequest.start();

let amqpSubscriptionChannel = new AmqpSubscribeChannel('amqp://' + config.amqpHost, config.getPublishQueue(), config.getResultQueue());
amqpSubscriptionChannel.logger = new Logger("AmqpSubscribeChannel", true);
amqpRequestHendler.channel = amqpSubscriptionChannel;


let handler = new StackHandler();
handler.addHandler(new FileHandler(__dirname + '/../public'));
handler.addHandler(new FileHandler('/macdata/projects/mutants/reanima-back/public'));

handler.addHandler(amqpRequestHendler);
handler.addHandler(new NotFoundHandler());

let processing = function (clientRequest, writeBack) {
    handler.handle(clientRequest, writeBack);
};

amqpSubscriptionChannel.init();
amqpSubscriptionChannel.start();

// Create server
let server = new HttpRequestSource(processing, 9080);
server.logger = new Logger("HttpRequestChannel", false);
server.init();
server.start();

let socketServer = new SocketSource(processing, 9081);
socketServer.logger = new Logger("SocketChannel", true);
socketServer.init();
socketServer.start();

