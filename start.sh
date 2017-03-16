#!/usr/bin/env bash

curConfigLink="/tmp/bpass.config.link"

if [ -f ${curConfigLink} ]; then
    oldConfigFile=$(readlink -n ${curConfigLink})
fi

pwd=$(pwd -P);

configDir=${pwd}"/cluster/config/";
configLink=${configDir}cluster.json;
curConfig=$(readlink -n ${configLink})

if [ ${curConfig}  ]; then
    configPath=${configDir}${curConfig}
    echo "Starting config ${configPath}";
    
    
    rm /tmp/bpass.config.link
    ln -s ${configPath} /tmp/bpass.config.link 
    pm2 start ${configPath}
    
    if [ ${oldConfigFile} ]; then
        echo "Stoppping ${oldConfigFile} ..."
        pm2 delete ${oldConfigFile}
        echo "Stopped ${oldConfigFile}."
    fi
    
  else
    echo "Config file ${configLink} not found. Not started.";
fi