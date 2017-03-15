#!/usr/bin/env bash
#npm install pm2 -g
#ps -ef | grep "node ./consume.js" | grep -v grep | awk '{print $2}' | xargs kill -9
#ps -ef | grep "node ./app.js" | grep -v grep | awk '{print $2}' | xargs kill -9

echo "Generate config ..."
node configGeneration.js
echo "Config generated."