"use strict";

class Logger {
    static getTimeFromStart() {
        if (!this._startTime) {
            this._startTime = Date.now();
        }
        
        return Math.round((Date.now()- this._startTime))/1000;
    }
    static setPrefixMaxLen(length) {
        this._prefixMaxLen = length;
    }
    set prefix (prefix) {
        this.setPrefix(prefix)
    }
    static getPrefixMaxLength() {
        if (!this._prefixMaxLen) {
            this._prefixMaxLen = 13;
        }
        
        return this._prefixMaxLen;
    }
    constructor (prefix) {
        this.setPrefix(prefix);
        this._showDebugLogs = false;
    }
    setPrefix(value) {
        if (value.length < Logger.getPrefixMaxLength()) {
            value += (new Array(Logger.getPrefixMaxLength() - value.length + 1).join(' '));
        }
        this._prefix = value;
    }
    getMessage(info) {
        try  {
            return this._prefix + ' [' + Logger.getTimeFromStart()  + '] > ' + (typeof info !== 'string' ? JSON.stringify(info, null, 4) : info);    
        } catch (e) {
            return this._prefix + ' [' + Logger.getTimeFromStart()  + '] > ' +  "Logger Error: " + e.message;  
        }
    }
    log (info) {
        console.log(this.getMessage(info));
    }
    warn (info) {
        console.warn(this.getMessage(info));
    }
    error (info) {
        console.error(this.getMessage(info))
    }
    debug (info) {
        if (this._showDebugLogs) {
            this.log(this.getMessage(info));
        }
    }
}

module.exports = Logger;