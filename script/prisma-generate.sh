#!/bin/bash

cd "$(dirname "$0")"

if [ -z "$1" ]; then
    echo "Project name is missing!"
    exit 1
fi

cd ..

pushd apps/$1

echo "workdir is: $(pwd)"

npx prisma generate
popd
