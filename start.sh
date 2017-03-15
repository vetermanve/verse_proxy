#!/usr/bin/env bash

curConfigLink="/tmp/bpass.config.link"

if [ -f ${curConfigLink} ]; then
    oldConfigFile=$(readlink -n ${curConfigLink})
    echo "Stoppping ${oldConfigFile} ..."
    pm2 delete ${oldConfigFile}
    echo "Stopped ${oldConfigFile}."
fi

pwd=$(pwd -P);

configDir=${pwd}"/cluster/config/";
curConfig=$(readlink -n ${configDir}cluster.json)
configPath=${configDir}${curConfig}
echo "Starting config ${configPath}";


rm /tmp/bpass.config.link
ln -s ${configPath} /tmp/bpass.config.link 
pm2 start ${configPath}