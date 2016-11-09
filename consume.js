var rabbit = require('rabbit.js');
var identity = require('./modules/identity.js').identity;
console.log(identity);

var context = rabbit.createContext('amqp://localhost');

var PubCloud = {
    publishing : (new Map),
    context : context,
    pubQueue : (new Map),
    publishResult : function (queue, result) {
        var self = this;
        var publisher = this.publishing.get(queue);
        
        if (!publisher) {
            publisher = new PubQueue(queue, self.context.socket('PUSH'));
            publisher.connect();
        }
        
        publisher.addMsg(result);
        this.publishing.set(queue, publisher);
    }
};

var PubQueue  = function (name, socket) {
    var self = this;
    self.name = name;
    self.msgQueue = [];
    self.connected = false;
    self.socket = socket;

    self.addMsg = function (msg) {
        self.msgQueue.push(msg);
        self.realizeQueue();
    };

    self.realizeQueue = function () {
        if (self.msgQueue.length == 0 || self.connected == false) {
            return ;
        }
        
        var bind = {};
        for (var i in self.msgQueue) {
            bind = self.msgQueue[i];
            console.log("Send response on " + bind.uid);
            self.socket.write(JSON.stringify(bind), 'utf8');
            delete self.msgQueue[i];
        }
    };

    self.connect = function () {
        self.socket.connect(self.name, function () {
            self.connected = true;
            self.realizeQueue();
        })
    }
};

context.on('ready', function() {
    var pub = context.socket('PUSH'),
        sub = context.socket('PULL')
        ;

    var incomingRequests = identity.getPublishQueue();  
    sub.connect(incomingRequests, function() {
        console.log('Fake worker listener ' + incomingRequests + ' ready');
    });
    

    var fakeAnswer = function (dataJson) {
        var data = JSON.parse(dataJson);

        console.log('fakeAnswer: get data ' + dataJson);

        if (typeof data == 'undefined') {
            console.log('fakeAnswer skip undefined data ');
            return ;
        }

        var bind = {
            code : 200,
            uid : data.uid,
            body : 'The context will emit "ready" when it\'s connected. at ' + data.path  + '!',
            head : []
        };
        
        PubCloud.publishResult(data.reply, bind)
    };

    sub.on('data', fakeAnswer);
});
