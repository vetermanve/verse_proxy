/**
 * Created by vetermanve on 09.11.16.
 */
var uuid = require("uuid");

var BackendRequest = function (method, path, query, reply) {
    var self = this;
    
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
    self.cookies = {};
};

exports.buildRequestObj = function (method, path, query, reply) {
    return new BackendRequest(method, path, query, reply) 
};

exports.pack = function (request) {
    return JSON.stringify(request.body);
};

exports.unpack = function (json) {
    return JSON.stringify(request.body);
};