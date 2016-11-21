/**
 * Created by vetermanve on 09.11.16.
 */

var uuid = require("node-uuid");
var os = require("os");
var envArgs = require('minimist');

var argv = process.env.args ? envArgs(process.env.args.split(' ')) : {};

var pmId = process.env.pm_id || uuid.v4();
var cloudName = argv.cloud || 'user';
var host = os.hostname().replace('.', "_");
var dc = argv.dc || 'single_dc';
var version = argv.version || 'v2';
var cloud = cloudName + '_' + version;

exports.identity = {
    dc : dc,
    host : host,
    cloud : cloud,
    node : pmId,
    ns : 'bpass',
    getNodeId : function () {
        return this.dc + '.' + this.host + '.' + this.node;
    },
    getPublishQueue : function () {
        return this.ns + '.' + this.dc + '.' + this.cloud;
    },
    getResultQueue : function () {
        return this.ns + '.' + this.getNodeId()
    }
};