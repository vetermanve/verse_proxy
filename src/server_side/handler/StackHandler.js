const AbstractHandler = require("./AbstractHandler");

class StackHandler extends AbstractHandler {

    constructor() {
        super();
        this.handlers = [];
    }

    handle(clientRequest, writeBack) {
        for (let handlerId in this.handlers) {
            let handler = this.handlers[handlerId];
            let isHandled = handler.handle(clientRequest, writeBack);
            if (isHandled) {
                return true;
            }
        }
    }
    addHandler (handler) {
        this.handlers.push(handler);
    }
}

module.exports = StackHandler;