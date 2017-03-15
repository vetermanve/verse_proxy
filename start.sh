#!/usr/bin/env bash

if [ -f /tmp/bpass.config.link ]; then
    config=$(readlink -n /tmp/bpass.config)
    echo "Stoppping ${config} by copy"
    pm2 delete /tmp/bpass.config
    echo "Stopped ${config}"
fi

curConfig=$(readlink -n ./cluster/config/cluster.json)
echo "Starting config ${curConfig} !";

#pwd=$(pwd -P);
#
#rm /tmp/bpass.config.link
#ln -s ${pwd}/cluster/config/cluster.json /tmp/bpass.config.link 
#cp ${pwd}/cluster.json /tmp/bpass.config 
#pm2 start cluster.json