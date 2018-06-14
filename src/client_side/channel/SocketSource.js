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
        this.socketsByDeviceId = new Map();
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
                self._unRegisterDeviceId(socket);
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
            if (response.state['device_id'] && response.state['device_id'][0].length > 0) {
                this._registerDeviceId(response.state['device_id'][0], socket);
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
        const self = this;
        if (!this.socketsByDeviceId.has(deviceId)) {
            this.logger.debug("writeToDevice device id "  + deviceId +  " not found");
            return false;
        }

        this.socketsByDeviceId.get(deviceId).forEach(function (socket, socketId) {
            try {
                socket.emit('event', payload);
                self.logger.debug(["deviceId message sent", deviceId, socketId]);
            } catch (e) {
                self.logger.error(e);
            }
        });
        
        return true;
    }
    // @todo move it to state handlers
    _registerDeviceId(deviceId, socket) {
        let deviceSocketsSet;
        
        if (this.socketsByDeviceId.has(deviceId)) {
            deviceSocketsSet = this.socketsByDeviceId.get(deviceId);
        } else {
            deviceSocketsSet = new Map();
            this.socketsByDeviceId.set(deviceId, deviceSocketsSet);
        }

        if (!deviceSocketsSet.has(socket.id)) {
            this.logger.debug(["deviceId is registered", deviceId, socket.id]);
            deviceSocketsSet.set(socket.id, socket);
        }
    }

    _unRegisterDeviceId(socket) {
        if (socket.state['device_id']) {
            const deviceId = socket.state['device_id'][0];
            if (this.socketsByDeviceId.has(deviceId)) {
                const deviceIdMap = this.socketsByDeviceId.get(deviceId);
                deviceIdMap.delete(socket.id);
                
                if (deviceIdMap.size === 0) {
                    this.socketsByDeviceId.delete(deviceId);
                    this.logger.debug(["deviceId full unregistered", deviceId, socket.id]);
                }
            }
        }
    }
}

module.exports = SocketSource;
