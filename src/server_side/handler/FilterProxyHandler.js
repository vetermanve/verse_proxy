const AbstractHandler = require('./AbstractHandler');

class FilterProxyHandler extends AbstractHandler {
    
    constructor(filter, handler) {
        super();
        this.filterCallback = filter;
        this.handler = handler; 
    }
    handle(clientRequest, writeBack) {
        if ((this.filterCallback)(clientRequest)) {
            return this.handler.handle(clientRequest, writeBack); 
        }
    }
}

module.exports = FilterProxyHandler;