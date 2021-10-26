#!/bin/bash

if [ -z "$1" ]; then
    print_usage "Remote is missing!"
fi

git push $1 master
