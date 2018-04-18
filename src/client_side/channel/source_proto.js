/**
 * Abstract request source class
 * @author me@vetermanve.com 
 **/
class AbstractRequestSource {
    
    constructor() {
        this._logger = {};
    }
    get logger () {
        return this._logger
    }
    set logger (logger) {
        this._logger = logger
    }
    init () {
        this.logger.log('Abstract Init');
    }
    start () {
        this.logger.log("Abstract start");
    }
}

module.exports = AbstractRequestSource;
