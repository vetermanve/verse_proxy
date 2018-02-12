#!/usr/bin/env bash

curConfigLink="/srv/www/conf/bpass.config.link"

if [ -f ${curConfigLink} ]; then
    oldConfigFile=$(readlink -n ${curConfigLink})
fi

pwd=$(pwd -P);

configDir=${pwd}"/cluster/config/";
configLink=${configDir}cluster.json;
curConfig=$(readlink -n ${configLink})

echo ${curConfig} ${oldConfigFile}

if [ ${curConfig}  ]; then
    configPath=${configDir}${curConfig}
    if [ ${oldConfigFile} ]; then
        if [ ${configPath} != $(readlink -n ${curConfigLink}) ]; then
            echo "Starting config ${configPath}";
            
            pm2 start ${configPath}
        
            echo "Stoppping ${oldConfigFile} ..."
            pm2 delete ${oldConfigFile}
            rm ${curConfigLink}
            ln -s ${configPath} ${curConfigLink} 
            
            echo "Stopped ${oldConfigFile}."
        else
            echo "Self restart detected."
            pm2 startOrRestart ${configPath}
        fi
    fi
    
  else
    echo "Config file ${configLink} not found. Not started.";
fi