const AbstractServerSideChannel = require('./AbstractServerSideChannel');
const uuid = require('uuid');
const rabbit = require('rabbit.js');
const Response = require('../../client_side/model/ClientResponse');
const Logger = require("../../logger/Logger");

class RabbitMqChannel extends AbstractServerSideChannel {
    
    constructor (amqpServerHost, requestPublishQueueName, responseQueueName) {
        super();
        this.host = amqpServerHost;
        this.requestPusblishQueueName = requestPublishQueueName;
        this.reponseQueueName = responseQueueName;
        this.pendingWriteBacks = new Map();
        
        this.sender = {};
        this.reader = {};
    }
    
    process(clientRequest, writeBack) {
        this.logger.debug("Process" + clientRequest);
        clientRequest.reply = this.reponseQueueName;
        this.sender.process(clientRequest);
        this.pendingWriteBacks.set(clientRequest.uuid, writeBack);
        return true;
    }


    init() {
        this.sender = new AmqpCloudPublisher(this.host, this.requestPusblishQueueName, Logger.getLogger('AmqpCloudPublisher', this.logger._showDebugLogs));
        this.reader = new AmqpCloudReader(this.host, this.reponseQueueName, Logger.getLogger('AmqpCloudReader', this.logger._showDebugLogs));
    }

    start() {
        this.sender.init();
        this.sender.start();
        
        this.reader.init();
        this.reader.callback = this._writeBack.bind(this);
        this.reader.start();
        
        return super.start();
    }
    _writeBack(response) {
        this.logger.debug(response);
        
        if (this.pendingWriteBacks.get(response.reply_uuid)) {
            this.pendingWriteBacks.get(response.reply_uuid)(response);
            this.pendingWriteBacks.delete(response.reply_uuid);
            return true;
        }
    }
}

class AbstractAmqpService {
    constructor (host, queue, logger) {
        this.host = host;
        this.queue = queue.toLowerCase();
        this.queueReady = false;
        this.context = {};
        this.reconnecting = false;
        this.logger = logger || {};
        this.socket = {};
    }

    init () {
        this.logger.log('init');
    }
    start () {
        const self = this;

        this.logger.log('start');
        this.context = rabbit.createContext(this.host, {durable: true, routing: 'direct'});

        const ctxtUuid = uuid.v4();
        this.context.uuid = ctxtUuid;

        this.context.on('ready', self._onReady.bind(self));
        this.context.on('error', function() {
            self._onConnectionError(ctxtUuid);
        });
    }
    
    _onConnectionError (uuid) {
        const self = this;
        this.logger.warn('_onConnectionError: ' + uuid + ' to ' + this.host);

        if (this.context.uuid === uuid && !self.reconnecting) {
            self.reconnecting = setTimeout(function () {
                self.reconnecting = false;
                self.start();
            }, 500);
        }
    }
    _onReady () {
        // should be implemented
    }
    _onConnect () {
        // should be implemented
    }
    _connect () {
        const self = this;

        try  {
            // sub.pipe(process.stdout);
            this.socket.connect(self.queue, function () {
                // self.logger.log("Queue connected: " + self.queue);
                self.socket.on('close', self._reconnect.bind(self));
                self.socket.on('error', self._reconnect.bind(self));
                self.queueReady = true;
                self._onConnect();
            });

            self.socket.on('error', self._reconnect.bind(self));
        } catch (e) {
            self.logger.log("Error on connect: " + e.message);
            setTimeout(self._reconnect.bind(self), 500);
        }
    }
    _reconnect (e) {
        this.logger.warn('Reconnect by reason: ' + e);

        this.queueReady = false;

        try  {
            this.socket.close();
        } catch (e){
            this.logger.debug('Previous connection can\'t be closed due error: ' + e.errno);
        }

        this._connect();
    }
    
}

class AmqpCloudPublisher extends AbstractAmqpService {

    init() {
        this.requestsQueue = new Map();
        return super.init();
    }

    start() {
        return super.start();
    }

    process(clientRequest) {
        if (this.queueReady) {
            let res = this.socket.write(JSON.stringify(clientRequest), 'utf8');
            this.logger.debug("Sent request: " + clientRequest.uuid + " "  + JSON.stringify(res));
        } else {
            this.logger.log("Postpone request: " + clientRequest.uuid);
            this.requestsQueue.push(clientRequest);
        }
    }
    
    _onReady () {
        this.logger.debug('Ready at: ' + this.host);
        this.socket = this.context.socket('PUSH');
        this._connect();
    }
    
    _onConnect () {
        this.logger.log('Connected ' + this.queue);
        while (this.requestsQueue.length && this.queueReady) {
            this.process(this.requestsQueue.pop());
        }
    }
}

class AmqpCloudReader  extends  AbstractAmqpService {

    set callback(callback) {
        this._callback = callback;
    }

    _onReady () {
        this.logger.log('Ready at: ' + this.host);

        this.socket = this.context.socket('PULL', {prefetch: 1});
        this.socket.setEncoding('utf8');

        this._connect();
    }
    _onConnect () {
        this.logger.log('Connected ' + this.queue);
        this.socket.on('data', this.process.bind(this));
    }
    process (dataJson) {
        try {
            let data = JSON.parse(dataJson) || {};
            
            let response = new Response(
                data.code,
                data.body,
                data.head,
                data.state,
                data.uid,
                data.reply_uuid || data.uid
            );
            
            this.logger.debug(response);

            let callResult = (this._callback)(response);
            if (!callResult) {
                this.logger.warn('Message was not handled: ' + dataJson );
            }
        } catch (e) {
            this.logger.error('Error write response: ' + dataJson + ', error: ' + e);
        }
    }
}

module.exports = RabbitMqChannel;