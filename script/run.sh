#!/bin/bash

cd "$(dirname "$0")"

source projects.sh

print_usage () {
    echo $1
    echo "Usage: ./build.sh <project>"
    echo "Supported projects: cga, cgl"
    exit 1
}

if [ -z "$1" ]
then
    print_usage "Project name is missing!"
fi

cd ..

node dist/apps/${project_names[$1]}/main.js

