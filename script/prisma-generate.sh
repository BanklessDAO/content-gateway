#!/bin/bash

if [ -z "$1" ]; then
    print_usage "Project name is missing!"
fi


pushd apps/$1
npx prisma generate
popd
