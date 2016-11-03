var rabbit = require('rabbit.js');

var context = rabbit.createContext('amqp://dev.alol.io');
context.on('ready', function() {
    var pub = context.socket('PUB'),
        sub = context.socket('SUB')
        ;

    sub.connect('bpass.client_requests', function() {
        console.log('Fake worker listener bpass.client_requests ready');
    });

    var pubReady = false;
    pub.connect('bpass.client_answers', function() {
        pubReady = true;
        console.log('Fake worker listener bpass.client_answers ready');
    });

    var fakeAnswer = function (dataJson) {
        var data = JSON.parse(dataJson);

        // console.log('fakeAnswer: get data ' + dataJson);

        if (typeof data == 'undefined') {
            console.log('fakeAnswer skip undefined data ');
            return ;
        }

        var bind = {
            code : 200,
            uid : data.uid,
            body : 'The context will emit "ready" when it\'s connected.',
            head : []
        };

        if (pubReady) {
            pub.write(JSON.stringify(bind), 'utf8');
        } else {
            console.log("fakeAnswer: publish not ready");
        }
    };

    sub.on('data', fakeAnswer);
});
