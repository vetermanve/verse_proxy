const AbstractSource = require("./AbstractRequestSource");
const http = require('http');
const createSocketIo = require('socket.io');

const Request = require("../model/ClientRequest");

class SocketSource extends AbstractSource {
    init() {
        super.init();
        this.server = http.createServer();
        this.io = createSocketIo(this.server);
    }
    start() {
        const self = this;
        super.start();
        
        this.server.listen(this.port, function () {
            self.logger.log("SocketSource started on port " + self.port);
        });
        const io = this.io;
        
        io.on('connection', function (socket) {
            reg.addConnection(socket);
            
            socket.on('request', function (msgData) {
                let request = new Request(
                    msgData.uuid,
                    msgData.method,
                    msgData.path,
                    msgData.query,
                    msgData.data,
                    msgData.headers,
                    msgData.state,
                );
                
                self.logger.debug(request);
                
                let processing = self.processing;
                
                let writeBack = function (response) {
                    self.response(response, socket, request)
                };
                
                processing(request, writeBack);
            });
        });
    }
    response (response, socket) {
        this.logger.debug(response);
        socket.emit('response', response);
    }
}


const reg = {
    connections: [],
    me: {},
    addConnection: function (socket) {
        const self = this;
        self.connections.push(socket);
        console.log('connection added: ' + self.connections.length + ' id ' + socket.id);

        socket.on('disconnect', function () {
            console.log('Got disconnect! ' + socket.id);
            let i = self.connections.indexOf(socket);
            self.connections.splice(i, 1);
        });
    },
    cast: function (msg) {
        for (let key in this.connections) {
            this.connections[key].emit('chat message', 'msg for ' + key);
        }
    },
    getId: function (socket) {
        return this.connections.indexOf(socket) + 1;
    },
    setMe: function (socket, me) {
        let id = this.getId(socket);
        return this.me[id] = me;
    },
    getMe: function (socket) {
        let id = this.getId(socket);
        return this.me[id] || id;
    }
};

module.exports = SocketSource;
