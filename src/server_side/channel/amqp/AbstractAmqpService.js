const rabbit = require('rabbit.js');
const uuid = require('uuid');

class AbstractAmqpService {
    constructor (host, queue, logger) {
        this.host = host;
        this.queue = queue.toLowerCase();
        this.queueReady = false;
        this.context = {};
        this.reconnecting = false;
        this.logger = logger || {};
        this.socket = {};
    }

    init () {
        this.logger.log('init');
    }
    start () {
        const self = this;

        this.logger.log('start');
        this.context = rabbit.createContext(this.host, {durable: true, routing: 'direct'});

        const ctxtUuid = uuid.v4();
        this.context.uuid = ctxtUuid;

        this.context.on('ready', self._onReady.bind(self));
        this.context.on('error', function() {
            self._onConnectionError(ctxtUuid);
        });
    }

    _onConnectionError (uuid) {
        const self = this;
        this.logger.warn('_onConnectionError: ' + uuid + ' to ' + this.host);

        if (this.context.uuid === uuid && !self.reconnecting) {
            self.reconnecting = setTimeout(function () {
                self.reconnecting = false;
                self.start();
            }, 500);
        }
    }
    _onReady () {
        // should be implemented
    }
    _onConnect () {
        // should be implemented
    }
    _connect () {
        const self = this;

        try  {
            // sub.pipe(process.stdout);
            this.socket.connect(self.queue, function () {
                // self.logger.log("Queue connected: " + self.queue);
                self.socket.on('close', self._reconnect.bind(self));
                self.socket.on('error', self._reconnect.bind(self));
                self.queueReady = true;
                self._onConnect();
            });

            self.socket.on('error', self._reconnect.bind(self));
        } catch (e) {
            self.logger.log("Error on connect: " + e.message);
            setTimeout(self._reconnect.bind(self), 500);
        }
    }
    _reconnect (e) {
        this.logger.warn('Reconnect by reason: ' + e);

        this.queueReady = false;

        try  {
            this.socket.close();
        } catch (e){
            this.logger.debug('Previous connection can\'t be closed due error: ' + e.errno);
        }

        this._connect();
    }
}

module.exports = AbstractAmqpService;
