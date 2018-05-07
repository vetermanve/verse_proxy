const AbstractServerSideChannel = require('./AbstractServerSideChannel');

const AmqpCloudPublisher = require('./amqp/AmqpCloudPublisher');
const AmqpCloudReader = require('./amqp/AmqpCloudReader');

const Response = require('../../client_side/model/ClientResponse');
const Logger = require("../../logger/Logger");

class RabbitMqChannel extends AbstractServerSideChannel {
    
    constructor (amqpServerHost, requestPublishQueueName, responseQueueName) {
        super();
        this.host = amqpServerHost;
        this.requestPusblishQueueName = requestPublishQueueName;
        this.reponseQueueName = responseQueueName;
        this.subscriptionWriteBacks = new Map();
        this.subscriptionWriteBacks = new Map();
        
        this.sender = {};
        this.reader = {};
    }
    
    process(clientRequest, writeBack) {
        this.logger.debug("Process" + clientRequest);
        clientRequest.reply = this.reponseQueueName;
        this.sender.process(clientRequest);
        this.subscriptionWriteBacks.set(clientRequest.uuid, writeBack);
        return true;
    }

    subscribe(clientRequest, writeBack) {
        this.logger.debug("Process" + clientRequest);
        clientRequest.reply = this.reponseQueueName;
        this.sender.process(clientRequest);
        this.subscriptionWriteBacks.set(clientRequest.uuid, writeBack);
        return true;
    }


    init() {
        this.sender = new AmqpCloudPublisher(
            this.host, 
            this.requestPusblishQueueName, 
            Logger.getLogger('AmqpCloudPublisher', this.logger._showDebugLogs)
        );
        
        this.reader = new AmqpCloudReader(
            this.host, 
            this.reponseQueueName, 
            Logger.getLogger('AmqpCloudReader', this.logger._showDebugLogs)
        );

        this.reader.callback = this._writeBack.bind(this);
    }

    start() {
        this.sender.init();
        this.sender.start();
        
        this.reader.init();
        this.reader.start();
        
        return super.start();
    }
    _writeBack(data) {
        this.logger.debug(data);

        let response = new Response(
            data.code,
            data.body,
            data.head,
            data.state,
            data.uid,
            data.reply_uuid || data.uid
        );
        
        if (this.subscriptionWriteBacks.get(response.reply_uuid)) {
            this.subscriptionWriteBacks.get(response.reply_uuid)(response);
            this.subscriptionWriteBacks.delete(response.reply_uuid);
            return true;
        }
    }
}

module.exports = RabbitMqChannel;