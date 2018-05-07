const AbstractSource = require("./AbstractRequestSource");
const Logger = require('../../logger/Logger');

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
            self.logger.debug('Connected: '+ socket.id + ', Connections count: '+ io.engine.clientsCount);

            socket.on('disconnect', function () {
                self.logger.debug('Disconnected: ' + socket.id);
            });
            
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
                
                try {
                    processing(request, writeBack);
                } catch (e) {
                    self.logger.error(e);
                }
            });
        });
    }
    response (response, socket) {
        this.logger.debug(response);
        socket.emit('response', response);
    }
}

module.exports = SocketSource;
