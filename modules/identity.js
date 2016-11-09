/**
 * Created by vetermanve on 09.11.16.
 */

exports.identity = {
    dc : 'office',
    host : 'iMike',
    node : 1,
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