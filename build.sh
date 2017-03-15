#!/usr/bin/env bash
echo "Install dependency ...";
[ -d logs ] || mkdir logs
npm install 2>&1 > logs/npm_install.
echo "Install dependency done.";