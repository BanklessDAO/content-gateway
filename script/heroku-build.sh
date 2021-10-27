#!/bin/bash

if [ -z "$1" ]; then
    print_usage "Project name is missing!"
fi

script/prisma-generate.sh $1 && nx build $1 --prod