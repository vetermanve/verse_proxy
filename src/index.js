const HttpRequestSource = require("./client_side/channel/HttpRequestChannel");
const SocketSource = require("./client_side/channel/SocketSource");
const Logger = require("./logger/Logger");

const StackHandler = require('./server_side/handler/StackHandler');
const FileHandler = require('./server_side/handler/FileHandler');
const ServerChanelHandler = require('./server_side/handler/ServerChannelHandler');

const NotFoundHandler = require('./server_side/handler/NotFoundHandler');
const AmqpRequestChannel = require('./server_side/channel/AmqpRequestChannel');
const AmqpCloudReader = require('./server_side/channel/amqp/AmqpCloudReader');

const PathStaticHandler = require('./server_side/handler/PathStaticHandler');

///// configuration
// read configuration
const config = require('./env/config');
// bind to local variables
const requestPublishingQueue = config.getPublishQueue();
const requestResultsReadQueue = config.getResultQueue();
const incomingEventsReadQueue = config.getResultQueue() + ":events";
const amqpConnectionHost = 'amqp://' + config.amqpHost;

//// Logger
// Global logger configuration
Logger.setPrefixMaxLen(18);

// Set-up core logger
let logger = new Logger("Core");
logger.log("This is a start!");

//// Setup handlers
//// Create function that should connect providers and handlers
let handler = new StackHandler();
let processing = function (clientRequest, writeBack) {
    handler.handle(clientRequest, writeBack);
};

//// Configure servers
// Create httpServer listen clients http requests
let httpServer = new HttpRequestSource(processing, 9080);
httpServer.logger = new Logger("HttpRequestChannel", false);

// Crate socket server listen client requests through socket
let socketServer = new SocketSource(processing, 9081);
socketServer.logger = new Logger("SocketChannel", false);

// Create amqp event reader to pass it to clients
let eventReader = new AmqpCloudReader(amqpConnectionHost, incomingEventsReadQueue);
eventReader.logger = Logger.getLogger('EventReader', true);
eventReader.callback = function (data) {
    if (typeof data !== 'undefined' && data['device_id']) {
        return socketServer.writeToDevice(data['device_id'], data);    
    }
    
    return false;
};

// amqp request channel
const amqpServerChannel = new AmqpRequestChannel(amqpConnectionHost, requestPublishingQueue, requestResultsReadQueue);
amqpServerChannel.logger = new Logger("RabbitServerChannel", false);

///////////////////////////////
//// File request handlers
// self proxy static files
handler.addHandler(new FileHandler(__dirname + '/../public'));
// other static files @todo move this to config;
handler.addHandler(new FileHandler('/macdata/projects/mutants/reanima-back/public'));

//// Set-up event reader and method to get node address to send events.
handler.addHandler(new PathStaticHandler('/socket/connection/address', {address: eventReader.queue}));

//// Amqp request handlers
// passing request to amqp for microservices processing 
const amqpRequestHandler = new ServerChanelHandler();
amqpRequestHandler.channel = amqpServerChannel;
handler.addHandler(amqpRequestHandler);

//// Final handler
// not found handler returns not found =)
handler.addHandler(new NotFoundHandler());

/////////////////////////////////////
//// Start all we should start
// client request and responses passing to microservices
amqpServerChannel.init();
amqpServerChannel.start();

// http server
httpServer.init();
httpServer.start();

// socket server
socketServer.init();
socketServer.start();

eventReader.init();
eventReader.start();

