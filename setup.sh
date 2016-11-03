#!/usr/bin/env bash
npm install
ps -ef | grep "node ./consume.js" | grep -v grep | awk '{print $2}' | xargs kill -9
ps -ef | grep "node ./app.js" | grep -v grep | awk '{print $2}' | xargs kill -9
npm run start &
echo "Backend Pass started"