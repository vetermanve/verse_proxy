/**
 * Created by vetermanve on 09.11.16.
 */

var uuid = require("node-uuid");
var os = require("os");
var envArgs = require('minimist');

var argv = process.env.args ? envArgs(process.env.args.split(' ')) : process.env;

var pmId = process.env.pm_id || uuid.v4();
var cloudName = argv.cloud  || 'local';
var host = os.hostname().replace('.', "_").toLowerCase();
var dc = argv.dc || 'dc';
var amqpHost = argv.host || 'localhost';
var version = argv.version || 'all';

exports.identity = {
    dc : dc,
    host : host,
    amqpHost : amqpHost,
    cloud : cloudName,
    node : pmId,
    version : version,
    ns : 'bpass',
    getNodeId : function () {
        return this.dc + '.' + this.host + '.' + this.node;
    },
    getPublishQueue : function (cloud) {
        return this.ns + '.' + this.dc + '.' + (cloud || this.cloud);
    },
    getResultQueue : function () {
        return this.ns + '.' + this.getNodeId()
    }
};