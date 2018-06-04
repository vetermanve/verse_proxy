const AbstractSource = require("./AbstractRequestChannel");
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
            self.logger.debug('Connected: '+ socket.id + ', Connections count: '+ io.engine.clientsCount + " headers: " + JSON.stringify(socket.request.headers));
            socket.state = {};
            
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
                    socket.request.headers,
                    socket.state || {},
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
        
        if (typeof response.state === 'object' && Object.keys(response.state).length) {
            if (typeof response.state['device_id'] === 'string' 
                && response.state['device_id'].length > 0) {
                    this.socketsByDeviceId.set(response.state['device_id'], socket);
                    this.logger.log(["deviceId is registered", response.state, socket.id]);
            }
            
            for (let prop in response.state) {
                if (response.state.hasOwnProperty(prop)) {
                    socket.state[prop] = response.state[prop];
                }
            }
        }
        
        socket.emit('response', response);
    }
    // @todo this method should be placed in socket connection but connections currently not decomosed form channels 
    writeToDevice (deviceId, payload) {
        if (!this.socketsByDeviceId.has(deviceId)) {
            return false;
        }

        try {
            this.socketsByDeviceId.get(deviceId).socket.emit('event', payload);
            this.logger.log(["deviceId message sent", deviceId, payload]);
        } catch (e) {
            this.logger.error(e);
        }

        return true;
    }
}

module.exports = SocketSource;
