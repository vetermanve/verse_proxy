var blog = {
    prefix : null,
    showDebugLogs : false,
    prefixLen : 13,
    startTime : 0,
    log : function (info, warn ) {
        warn = warn || false;
        
        if (!blog.startTime) {
            blog.startTime = Date.now();
        }

        if (this.prefix.length < this.prefixLen) {
            this.prefix += (new Array(this.prefixLen - this.prefix.length + 1).join(' '));
        }

        info = this.prefix + ' [' + Math.round((Date.now()- blog.startTime))/1000  + '] > ' + (typeof info != 'string' ? JSON.stringify(info, null, 4) : info);

        if (warn) {
            console.warn(info);
        } else if(this.debug) {
            console.log(info);
        }
    },
    warn : function (info) {
        this.log(info, true);
    },
    debug : function (info) {
        if (this.showDebugLogs) {
            this.log(info);
        }
    },
    error : function (info) {
        this.log(info, true);
    }
};

exports.init = function (name) {
    blog.prefix = name || 'dev';
    return blog;
};