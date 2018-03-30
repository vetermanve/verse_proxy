/** 
 * Request performance monitor by @vetermanve
 * */

var ReqPerformance = {
    logs : [],
    log : {
        cnt : 0,
        avg : 0,
        time : 0
    },
    id : 0 ,
    add: function (exTime) {
        var timeId = Math.floor(Date.now()/1000);

        if (this.id !== timeId) {
            if (this.log.cnt) {
                this.logs.push(Object.assign({},  this.log));
            }

            if (this.logs.length > 10) {
                this.logs.shift();
            }

            this.log = {
                id : timeId,
                date : new Date(timeId * 1000).toISOString(),
                cnt : 0,
                avg : 0,
                time : 0
            };

            this.id = timeId;
        }

        this.log.cnt++;
        this.log.time += exTime;
        this.log.avg = Math.round((this.log.time / this.log.cnt * 10000))/10000;
    }
};

exports = ReqPerformance;