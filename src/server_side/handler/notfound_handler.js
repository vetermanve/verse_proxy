const AbstractHandler = require('./abstract_handler');
const Response = require('../../client_side/model/client_response');

class NotFoundHandler extends AbstractHandler {
    handle(clientRequest, writeBack) {
        writeBack(new Response(404, "Path " + clientRequest.path + " not found."));
        return true;
    }
}

module.exports = NotFoundHandler;