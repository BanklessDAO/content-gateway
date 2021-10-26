#!/bin/bash

if [ -z "$1" ]
then
    echo "Remote is missing!"
fi

heroku logs --remote $1 --tail