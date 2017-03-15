/**
 * Created by vetermanve on 15.03.17.
 */

var fs = require('fs');

var releaseData = {
    "id"     : "local",
    "date"   : "today",
    "release": "local_dev"
};
try {
    releaseData = require('./release.json');
} catch (e) {
    console.log('Release file not found');
}

var config = {
    "apps": [{
        "name"              : "bpass." + releaseData.id,
        "script"            : "app.js",
        "instances"         : "max",
        "kill_timeout"      : 30000,
        "error_file"        : "/dev/null",
        "out_file"          : "/dev/null",
        "max_memory_restart": "300M",
        "exec_mode"         : "cluster"
    }]
};

fs.writeFileSync('cluster.json', JSON.stringify(config, null, 2));

console.log(releaseData);