const AbstractHandler = require('./AbstractHandler');

class ServerChannelHandler extends AbstractHandler {
    
    set channel (channel) {
        this._channel = channel;
    }

    get channel () {
        return this._channel;
    }
    
    handle(clientRequest, writeBack) {
        return this._channel.process(clientRequest, writeBack);
    }
}

module.exports = ServerChannelHandler;