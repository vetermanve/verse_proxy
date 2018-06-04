const AbstractAmqpService = require('./AbstractAmqpService');

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

module.exports = AmqpCloudPublisher;