const AbstractHandler = require('./AbstractHandler');
const Response = require('../../client_side/model/ClientResponse');

class PathStaticHandler extends AbstractHandler {
    
    constructor(path, data) {
        super();
        this._path = path;
        this._data = data;
    }

    set path (value) {
        this._path = value;
    }
    set data(value) {
        this._data = value;
    }
    handle(clientRequest, writeBack) {
        if (clientRequest.path !== this._path) {
            return false
        }
        
        let response = new Response(200, this._data);

        response.reply_uuid = clientRequest.uuid;
        
        writeBack(response);

        return true;
    }
}

module.exports = PathStaticHandler;