const AbstractHandler = require('./../AbstractHandler');
const Response = require('./../../../client_side/model/ClientResponse');

class ConnectionAddressHandler extends AbstractHandler {
    
    constructor(path, address) {
        super();
        this._path = path;
        this._address = address;
    }

    set addressPath (value) {
        this._path = value;
    }
    set address(value) {
        this._address = value;
    }
    handle(clientRequest, writeBack) {
        if (clientRequest.path !== this._path) {
            return false
        }
        
        let response = new Response(200, {
            address : this._address
        });

        response.reply_uuid = clientRequest.uuid;
        writeBack(response);

        return true;
    }
}

module.exports = ConnectionAddressHandler;