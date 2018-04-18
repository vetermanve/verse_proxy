const uuidv4 = require('uuid/v4');

class ClientResponse {
    constructor (code, data, headers, state, uuid, reply_uuid, request) {
        this.code = code;
        this.data = data || {};
        this.headers = headers || [];
        this.state = state || {};
        this.uuid = uuid || uuidv4();
        this.reply_uuid = reply_uuid || '';
        this.request = request || null;
    }
}

module.exports = ClientResponse;