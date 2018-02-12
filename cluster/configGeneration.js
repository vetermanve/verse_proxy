/**
 * Created by vetermanve on 15.03.17.
 */

var fs = require('fs');

var releaseData = {
    "id"     : Date.now(),
    "date"   : "today",
    "release": "local_dev",
    "slot"   : "dc"
};
try {
    releaseData = require('../release.json');
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
        "exec_mode"         : "cluster",
        "env": {
            "dc": releaseData.slot
        }
    }]
};

// ensure config directory
var configDir = 'cluster/config/'; 

if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir);    
}

// write target config
var targetFile = 'cluster_' + releaseData.id + '.json';

fs.writeFileSync(configDir + targetFile, JSON.stringify(config, null, 2));

// write target link
console.log('Unlink ' + (fs.existsSync(targetLink) ? 'Y' : 'N'));

var targetLink = configDir + 'cluster.json'; 
try  {
    if (fs.readlinkSync(targetLink)) {
        fs.unlinkSync(targetLink);
    }  
} catch (e) { }

fs.symlinkSync(targetFile, targetLink);

// show release data
console.log(releaseData);