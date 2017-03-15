#!/usr/bin/env bash

if [ -f /tmp/bpass.config.link ]; then
    config=$(readlink -n /tmp/bpass.config)
    echo "Stoppping ${config} by copy"
    pm2 delete /tmp/bpass.config
    echo "Stopped ${config}"
fi

pwd=$(pwd -P);
echo "Starting ${pwd}/cluster.json";
rm /tmp/bpass.config
ln -s ${pwd}/cluster.json /tmp/bpass.config.link 
cp ${pwd}/cluster.json /tmp/bpass.config 
pm2 start cluster.json