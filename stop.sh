#!/usr/bin/env bash

pwd=$(pwd -P);

configDir=${pwd}"/cluster/config/";
curConfig=$(readlink -n ${configDir}cluster.json)
configPath=${configDir}${curConfig}

echo "Stoppping ${configPath} ..."
pm2 delete ${configPath}
echo "Stopped ${configPath}."