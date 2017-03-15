#!/usr/bin/env bash

if [ -f /tmp/bpass.config ]; then
    config=$(readlink /tmp/bpass.config);
    echo "Stoppping ${config}";
    pm2 stop ${config}; 
fi

echo "Starting $(pwd)/cluster.json";
rm /tmp/bpass.config
ln -s $(pwd)/cluster.json /tmp/bpass.config 
pm2 start cluster.json