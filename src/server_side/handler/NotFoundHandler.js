const AbstractHandler = require('./AbstractHandler');
const Response = require('../../client_side/model/ClientResponse');

class NotFoundHandler extends AbstractHandler {
    handle(clientRequest, writeBack) {
        writeBack(new Response(404, "Path " + clientRequest.path + " not found."));
        return true;
    }
}

module.exports = NotFoundHandler;