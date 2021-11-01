#!/bin/bash

if [ -z "$1" ]; then
    print_usage "Project name is missing!"
fi

nx build $1 --prod