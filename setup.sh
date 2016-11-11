#!/usr/bin/env bash
[ -d logs ] || mkdir logs
npm install 2>&1 > logs/npm_install.log
#npm install pm2 -g
#ps -ef | grep "node ./consume.js" | grep -v grep | awk '{print $2}' | xargs kill -9
#ps -ef | grep "node ./app.js" | grep -v grep | awk '{print $2}' | xargs kill -9
pm2 startOrRestart cluster.json
echo "Backend Pass started"