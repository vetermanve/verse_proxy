
var rabbit = require('rabbit.js');
var uuid = require("uuid");

var AmqpCloudPublisher = {
    /* amqp connection meta */
    host         : '',
    queue        : '',

    /* amqp state and objects */
    context      : {},
    publisher    : {},
    queueReady   : false,

    /* publish items queue */
    requestsQueue: [],

    logger : {},
    log : function (data) {
        this.logger.log(data);
    },

    /* init publisher */
    init: function (host, queue, cloud, logger) {
        var self = this;
        self.host = host;
        self.queue = queue.toLowerCase();
        self.logger = logger;
        self.logger.prefix = 'Publisher ' + cloud;
        self.initContext();
    },

    initContext : function () {
        var self = this;

        self.log('initContext');
        self.context = rabbit.createContext(self.host, {persistent : true});

        var ctxtUuid = uuid.v4();
        self.context.uuid = ctxtUuid;

        self.context.on('ready', self.onInit.bind(self));
        self.context.on('error', function() {
            self.onConnectionError(ctxtUuid);
        });
    },

    onConnectionError : function(uuid) {
        var self = this;
        this.log('onConnectionError: ' + uuid + ' to ' + this.host);

        if (this.context.uuid === uuid && !self.reconnecting) {
            self.reconnecting = setTimeout(function () {
                self.reconnecting = false;
                self.initContext();
            }, 500);
        }
    },

    onInit: function () {
        var self = this;
        this.log('socket ready at: ' + self.host);
        self.publisher = self.context.socket('PUSH');
        self.connect();
    },

    add: function (backendRequest) {
        if (this.queueReady) {
            this.log("Sent request: " + backendRequest.uid);
            backendRequest.addTrace('AmqpCloudPublisher add');
            this.publisher.write(backendProtocol.pack(backendRequest), 'utf8');
        } else {
            this.log("Postpone request: " + backendRequest.uid);
            this.requestsQueue.push(backendRequest);
        }
    },

    reconnect: function (e) {
        var self = this;
        self.log('reconnect case: ' + e);

        self.queueReady = false;
        try  {
            self.reader.close();
        } catch (e){
            self.log('connection close error: ' + e.errno);
        }

        this.connect();
    },

    connect: function () {
        var self = this;

        try  {
            // sub.pipe(process.stdout);
            this.publisher.connect(self.queue, function () {
                self.log("ready on queue: " + self.queue);
                self.publisher.on('close', self.reconnect.bind(self));
                self.publisher.on('error', self.reconnect.bind(self));
                self.queueReady = true;
                self.processQueue();
            });

            self.publisher.on('error', self.reconnect.bind(self));
        } catch (e) {
            this.log("AmqpCloudPublisher: Error on connect: " + e.message);
            setTimeout(self.reconnect.bind(self), 500);
        }
    },
    processQueue : function () {
        while (this.requestsQueue.length && this.queueReady) {
            var req = this.requestsQueue.pop();
            this.add(req);
        }
    }
};

var AmqpCloudResultReader = {
    /* amqp connection meta */
    host         : '',
    queue        : '',

    /* amqp state and objects */
    context      : null,
    currentUuid : '',
    reader    : {},
    queueReady   : false,
    reconnecting : false,
    logger : {},
    log : function (data) {
        this.logger.log(data);
    },
    /* init reader */
    init: function (host, queue, logger) {
        var self = this;
        self.host = host;
        self.queue = queue.toLowerCase();
        self.logger = logger;
        self.logger.prefix = 'Reader';
        self.initContext();
    },

    initContext : function () {
        var self = this;

        self.log('initContext');
        self.context = rabbit.createContext(self.host, {durable: true, routing: 'direct'});

        var ctxtUuid = uuid.v4();
        self.context.uuid = ctxtUuid;

        self.context.on('ready', self.onInit.bind(self));
        self.context.on('error', function() {
            self.onConnectionError(ctxtUuid);
        });

    },

    onInit: function () {
        var self = this;
        this.log('socket ready at: ' + self.host);

        self.reader = self.context.socket('PULL', {prefetch: 1});
        self.reader.setEncoding('utf8');

        self.connect();
    },

    onData: function (dataJson) {
        var self = this;
        try {
            var data = JSON.parse(dataJson);

            self.log('Read response: ' + data.uid + ' from ' + data.from);

            if (Requests.has(data.uid)) {
                Requests.writeResponse(data.uid, data.code, data.head, data.body, data.state || {});
            } else if (SocketRequests.has(data.uid)) {
                SocketRequests.writeResponse(data.uid, data.code, data.head, data.body, data.state || {});
            } else {
                blog.warn('Message ' + data.uid + ' was not sent to client: no subscribers found.');
            }
        } catch (e) {
            self.log('Error write response: ' + dataJson + ', error: ' + e);
        }
    },
    onConnectionError : function(uuid) {
        var self = this;
        this.log('onConnectionError: ' + uuid);

        if (this.context.uuid === uuid && !self.reconnecting) {
            self.reconnecting = setTimeout(function () {
                self.reconnecting = false;
                self.initContext();
            }, 500);
        }
    },
    reconnect: function (e) {
        var self = this;
        self.log('reconnect case: ' + e);

        self.queueReady = false;
        try  {
            self.reader.close();
        } catch (e){
            self.log('connection closed: ' + e);
        }

        this.connect();
    },

    connect: function () {
        var self = this;

        try  {
            self.reader.connect(self.queue, function () {
                self.log("ready on queue: " + self.queue);
                self.reader.on('close', self.reconnect.bind(self));
                self.reader.on('data', self.onData.bind(self));
                self.reader.on('error', self.reconnect.bind(self));
                self.queueReady = true;
            });
        } catch (e) {
            self.log("Error on connect: " + e.message);
            setTimeout(self.reconnect.bind(self), 500);
        }
    }
};

exports.publisher = function (host, queue, cloud, logger) {
    var pub = Object.create(AmqpCloudPublisher);
    pub.init(host, queue, cloud, logger);
    return pub;
};

exports.reader = function (host, queue, logger) {
    var read = Object.create(AmqpCloudPublisher);
    read.init(host, queue, logger);
    return read;
};