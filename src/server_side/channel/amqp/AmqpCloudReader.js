const AbstractAmqpService = require('./AbstractAmqpService');

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
    process (incomingJson) {
        try {
            let incomingData = JSON.parse(incomingJson) || {};

            this.logger.debug(['Got data', incomingData]);

            let callResult = (this._callback)(incomingData);
            if (!callResult) {
                this.logger.warn('Message was not handled: ' + incomingJson );
            }
        } catch (e) {
            this.logger.error('Error write response: ' + incomingJson + ', error: ' + e);
        }
    }
}

module.exports = AmqpCloudReader;