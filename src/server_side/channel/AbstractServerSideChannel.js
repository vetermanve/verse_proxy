
class AbstractServerSideChannel {
    process(clientRequest, writeBack) {
        
    }

    init () {
        this.logger.log('AbstractServerSideChannel Init');
    }
    start () {
        this.logger.log("AbstractServerSideChannel start");
    }

    constructor (processing, port) {
        this._processing = processing;
        this.port = port || 9080;
        this.server = {};
        this._logger = {};
    }
    get logger () {
        return this._logger
    }
    set logger (logger) {
        this._logger = logger
    }
}

module.exports = AbstractServerSideChannel;