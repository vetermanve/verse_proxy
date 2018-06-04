var http = require('http').createServer();
var io = require('socket.io')(http);

http.listen(3030, function () {
    console.log('socket listening on *:3030');
});

var SocketRequests =  {
    timing : [],
    logId : [],
    process : {},
    socketRequests : {},
    init : function () {
        this.process = new Map();
        this.socketRequests = new Map();
    },
    has : function () {
        return this.process.has(uid);
    },
    register: function (socket, backendRequest) {
        var uid = backendRequest.uid;
        var socketId = socket.id;

        var self = this;

        this.process.set(uid, backendRequest);

        backendRequest.resultStream.on('close', function() {
            self.clearRequest(uid, 'remote stream close');
        });
        backendRequest.resultStream.on('error', function () {
            self.clearRequest(uid, 'result stream error');
            blog.error('Requests: error on http request on ' + backendRequest.body.method + " "+ backendRequest.body.path);
        });
    },
    clearRequests : function (socketId, reason) {
        reason = reason || 'unknown';
        this.process.delete(uid);
        blog.warn('Http request closed ' + uid + " by reason: " + reason);
    },
    writeResponse : function (uid, code, head, body, state) {
        var backendRequest = this.process.get(uid);

        code = code || 503;

        if (typeof backendRequest === 'undefined') {
            blog.warn('uid ' + uid + ' result object not found. Body skip');
            return false;
        }

        var res = backendRequest.resultStream;
        backendRequest.addTrace('Requests writeResponse');

        var processing = (Date.now() - backendRequest.born) / 1000;
        ReqPerformance.add(processing);

        res.shouldKeepAlive = false;

        var cookies = backendRequest.cookies;

        try {
            var stateItem;
            var origin = backendRequest.request.headers['origin'] || '';
            var domain = url.parse(origin).hostname;

            domain = domain.split('.').slice(-2).join('.');

            for (var stateKey in state) {
                stateItem = state[stateKey];
                cookies.set(stateKey, stateItem[0], {domain: domain, httpOnly: true, expires: new Date(stateItem[1]*1000)})
            }
        } catch (e) {
            blog.error(e);
        }

        res.writeHead(code, head);

        if (backendRequest.body.method !== 'OPTIONS' && backendRequest.body.method !== 'HEAD') {
            if (typeof body === 'object') {
                try  {
                    body.p_time = processing;
                } catch (e) {}
                res.write(JSON.stringify(body));
            } else {
                res.write(body);
            }
        }

        res.end();

        this.process.delete(uid);
    }
};


var reg = {
    connections: [],
    me: {},
    addConnection: function (socket) {
        var self = this;
        self.connections.push(socket);
        console.log('connection added: ' + self.connections.length + ' id ' + socket.id);

        socket.on('disconnect', function () {
            console.log('Got disconnect! ' + socket.id);
            var i = self.connections.indexOf(socket);
            self.connections.splice(i, 1);

            SocketRequests.clearRequest()
        });
    },
    cast: function (msg) {
        for (var key in this.connections) {
            this.connections[key].emit('chat message', 'msg for ' + key);
        }
    },
    getId: function (socket) {
        return this.connections.indexOf(socket) + 1;
    },
    setMe: function (socket, me) {
        var id = this.getId(socket);
        return this.me[id] = me;
    },
    getMe: function (socket) {
        var id = this.getId(socket);
        return this.me[id] || id;
    }
};

io.on('connection', function (socket) {
    reg.addConnection(socket);
    socket.on('shell_request', function (msgData) {
        socket.broadcast.emit('shell_request', msgData);
        console.log("request", msgData);
        console.log("from " + socket.id);

        var msg = msgData.command || '';

        var command = msg.split(' ')[0];
        if (command === '/me') {
            reg.setMe(socket, msg.split(' ').slice(1).join(' '));
            return;
        }

        if (command === '/get') {
            var resource = msg.split(' ').slice(1).join(' ');

            var backendRequest = backendProtocol.buildRequestObj('get', resource, '', identity.getResultQueue());
            backendRequest.cookies = [];
            backendRequest.body.headers= [];

            var cloudName = Object.keys(Haven.routes)[0];
            Haven.getCloud(cloudName).add(backendRequest);
            backendRequest.setData('cleared');
            console.log(backendRequest);
        }

        var id = reg.getMe(socket);
        msg = id + ": " + msg;
        io.emit('message', msg);
    });

    socket.on('shell_response', function (msgData) {
        msgData = JSON.parse(msgData);
        console.log("got response", msgData);
        socket.broadcast.emit('shell_response', msgData);
    });
});

