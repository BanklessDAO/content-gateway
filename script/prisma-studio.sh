#!/bin/bash

cd "$(dirname "$0")"

source projects.sh

if [ -z "$1" ]; then
    echo "project is missing!"
fi

cd ..

pushd ${projects[$1]}

workdir=$(pwd)
echo "Workdir is: $workdir"

npx prisma studio

popd