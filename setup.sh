#!/usr/bin/env bash
[ -d logs ] || mkdir logs
npm install > logs/npm_install.log
ps -ef | grep "node ./consume.js" | grep -v grep | awk '{print $2}' | xargs kill -9
ps -ef | grep "node ./app.js" | grep -v grep | awk '{print $2}' | xargs kill -9
npm run start >> logs/run.log &
npm run consume >> logs/consume.log &
echo "Backend Pass started"