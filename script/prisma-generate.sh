#!/bin/bash

pushd apps/content-gateway-api
npx prisma generate
popd

pushd apps/content-gateway-ingester
npx prisma generate
popd
