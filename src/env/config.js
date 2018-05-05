/**
 * Created by vetermanve on 09.11.16.
 */
const uuid = require("uuid");
const os = require("os");
const envArgs = require('minimist');

const argv = process.env.args ? envArgs(process.env.args.split(' ')) : process.env;

const pmId = process.env.pm_id || uuid.v4();
const cloudName = argv.cloud  || 'all';
const host = os.hostname().replace('.', "_").toLowerCase();
const dc = argv.dc || 'dc';
const amqpHost = argv.host || 'localhost';
const version = argv.version || 'all';

module.exports = {
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