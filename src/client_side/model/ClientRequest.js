const uuidv4 = require('uuid/v4');

class ClientRequest {
    constructor (uuid, method, path, query, data, headers, state) {
        this.uuid = uuid || uuidv4();
        this.method = method;
        this.path = path || '';
        this.query = query || '';
        this.data = data || {};
        this.headers = headers || {};
        this.state = state || {};
        this.born = Date.now()/1000;
    }
}

module.exports = ClientRequest;

/* var self = this;
    
    var uid = uuid.v4();
    var born = Date.now();
    
    self.body = {
        uid : uid, 
        
        method : method,
        path : path,
        query : query || '',
        headers : {},
        data : {}, 
        
        reply: reply || '',
        born : born
    };
    
    self.setData = function (data) {
        self.body.data = data;  
    };

    self.uid = uid;
    self.born = Date.now();
    
    self.trace = [];
    
    self.addTrace = function (point) {
        self.trace.push([Date.now() - self.born, point]);
    };
    
    self.setReply = function (replyTo) {
        self.body.reply = replyTo;
    };
    
    self.resultStream = {};
    self.request = {};
    self.cookies = {}; */