#!/usr/bin/env bash

curConfigLink="/srv/www/conf/bpass.config.link"


pwd=$(pwd -P);

configDir=${pwd}"/cluster/config/";
configLink=${configDir}cluster.json;
curConfig=$(readlink -n ${configLink})
oldConfig=$(readlink -n ${curConfigLink})

if [ ${curConfig}  ]; then
    echo "We has a config ${curConfig}";
    configPath=${configDir}${curConfig}
    if [ ${configPath} != ${oldConfig} ]; then
        echo "Starting new config ${configPath}";
        
        pm2 start ${configPath}
    
        if [ ${oldConfig} ]; then
            echo "Stoppping ${oldConfig} ..."
            pm2 delete ${oldConfig}
            echo "Stopped ${oldConfig}."
        fi;
        
        rm ${curConfigLink}
        ln -s ${configPath} ${curConfigLink} 
    else
        echo "Self restart detected."
        pm2 startOrRestart ${configPath}
    fi
    
  else
    echo "Config file ${configLink} not found. Not started.";
fi