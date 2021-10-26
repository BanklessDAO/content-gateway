#!/bin/bash

cd "$(dirname "$0")"

source projects.sh

if [ -z "$1" ]; then
    print_usage "Project name is missing!"
fi

cd ..

pushd ${projects[$1]}
npx prisma generate
popd
