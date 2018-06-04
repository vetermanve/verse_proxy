/**
 * Abstract request source class
 * @author me@vetermanve.com 
 **/
class AbstractRequestSource {
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
    set processing(callable) {
        this._processing = callable;
    }
    get processing () {
        return this._processing;
    }
    init () {
        // this.logger.log('Abstract Init');
    }
    start () {
        // this.logger.log("Abstract start");
    }
}

module.exports = AbstractRequestSource;
