#!/bin/bash

cd "$(dirname "$0")"

source projects

print_usage () {
    echo $1
    echo "Usage: ./prisma-migrate.sh <project> <migration-file-name>"
    echo "Supported projects: cga, cgi"
    exit 1
}

if [ -z "$1" ]
then
    print_usage "Project name is missing!"
fi

if [ -z "$2" ]
then
    print_usage "Migration file name is missing!"
fi

cd ..

pushd ${projects[$1]}

workdir=$(pwd)
echo "Workdir is: $workdir"

npx prisma migrate dev --name $2

