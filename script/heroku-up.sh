#!/bin/bash

source projects

if [ -z "$1" ]; then
    print_usage "Remote is missing!"
fi

git push heroku ${projects[$1]}
