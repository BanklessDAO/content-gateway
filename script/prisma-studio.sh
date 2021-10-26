#!/bin/bash

cd "$(dirname "$0")"

source projects

if [ -z "$1" ]; then
    echo "project is missing!"
fi

cd ${projects[$1]}
npx prisma studio