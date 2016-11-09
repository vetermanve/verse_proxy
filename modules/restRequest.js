/**
 * Created by vetermanve on 09.11.16.
 */

var RestRequest = function (uid, method, path, query, reply) {
    var self = this;
    self.uid = uid;
    self.path = path;
    self.method = method;
    self.query = query || '';
    self.reply = reply;
    self.trace = [];
    self.born = Date.now();
    self.addTrace = function (point) {
        self.trace.push([Date.now() - self.born, point]);
    }
};

exports.build = function (uid, method, path, query, reply) {
    return new RestRequest(uid, method, path, query, reply) 
};