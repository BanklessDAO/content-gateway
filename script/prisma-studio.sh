#!/bin/bash

cd "$(dirname "$0")"

source projects.sh

if [ -z "$1" ]; then
    echo "project is missing!"
fi

cd ${projects[$1]}
npx prisma studio