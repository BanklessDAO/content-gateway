#!/bin/bash

cd "$(dirname "$0")"

if [ -z "$1" ]; then
    print_usage "Project name is missing!"
fi

cd ..

pushd apps/$1

echo "workdir is: $(pwd)"

npx prisma generate
popd
