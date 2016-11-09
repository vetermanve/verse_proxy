/**
 * Created by vetermanve on 09.11.16.
 */

var uuid = require("node-uuid");

var pmId = process.env.pm_id || uuid.v4();

exports.identity = {
    dc : 'office',
    host : 'iMike',
    node : pmId,
    ns : 'bpass',
    getNodeId : function () {
        return this.dc + '.' + this.host + '.' + this.node;
    },
    getPublishQueue : function () {
        return this.ns + '.' + this.dc;
    },
    getResultQueue : function () {
        return this.ns + '.' + this.getNodeId()
    },
    getReply : function (uid) {
        return {
            dc : this.dc,
            host : this.host,
            node : this.node,
            uid : uid
        }
    }
};