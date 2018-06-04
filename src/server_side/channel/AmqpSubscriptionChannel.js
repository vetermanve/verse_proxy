const AbstractServerSideChannel = require('./AbstractServerSideChannel');

const AmqpCloudPublisher = require('./amqp/AmqpCloudPublisher');
const AmqpCloudReader = require('./amqp/AmqpCloudReader');

const Response = require('../../client_side/model/ClientResponse');
const Logger = require("../../logger/Logger");

class AmqpSubscriptionChannel extends AbstractServerSideChannel {
    
    constructor (amqpServerHost, subscriptionsQeueueName) {
        super();
        this.host = amqpServerHost;
        this.reponseQueueName = subscriptionsQeueueName;
        this.responseWriteBacks = new Map();
        
        this.reader = {};
    }
    
    init() {
        this.reader = new AmqpCloudReader(
            this.host, 
            this.reponseQueueName, 
            Logger.getLogger('AmqpSubsReader', this.logger._showDebugLogs && false)
        );

        this.reader.callback = this._writeBack.bind(this);
    }

    start() {
        this.reader.init();
        this.reader.start();
        
        return super.start();
    }
    
    _writeBack(data) {
        this.logger.debug(data);

        let message = new Response(
            data.code,
            data.body,
            data.head,
            data.state,
            data.uid,
            data.reply_uuid || data.uid
        );
        
        if (this.responseWriteBacks.get(message.reply_uuid)) {
            try {
                this.responseWriteBacks.get(message.reply_uuid)(message);
            } catch (e) {
                this.logger.error(["Write back had and error", e]);
                this.responseWriteBacks.delete(message.reply_uuid);
            }
            
            return true;
        } else {
            this.responseWriteBacks.delete(message.reply_uuid);
        }
    }
}

module.exports = AmqpSubscriptionChannel;