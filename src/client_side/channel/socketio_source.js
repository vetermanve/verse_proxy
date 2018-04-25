const AbstractSource = require("./source_proto");
const http = require('http');
const createSocketIo = require('socket.io');

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
        console.log(io);
        
        io.on('connection', function (socket) {
            reg.addConnection(socket);
            socket.on('shell_request', function (msgData) {
                socket.broadcast.emit('shell_request', msgData);
                console.log("request", msgData);
                console.log("from " + socket.id);

                let msg = msgData.command || '';

                let command = msg.split(' ')[0];
                if (command === '/me') {
                    reg.setMe(socket, msg.split(' ').slice(1).join(' '));
                    return;
                }

                if (command === '/get') {
                    let resource = msg.split(' ').slice(1).join(' ');

                    let backendRequest = backendProtocol.buildRequestObj('get', resource, '', identity.getResultQueue());
                    backendRequest.cookies = [];
                    backendRequest.body.headers= [];

                    let cloudName = Object.keys(Haven.routes)[0];
                    Haven.getCloud(cloudName).add(backendRequest);
                    backendRequest.setData('cleared');
                    console.log(backendRequest);
                }

                let id = reg.getMe(socket);
                msg = id + ": " + msg;
                io.emit('message', msg);
            });

            socket.on('shell_response', function (msgData) {
                msgData = JSON.parse(msgData);
                console.log("got response", msgData);
                socket.broadcast.emit('shell_response', msgData);
            });
        });
    }
    response () {
        
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

            SocketRequests.clearRequest()
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
