#!/bin/bash

docker build -t inigma .
docker stop inigma
docker rm inigma
docker run --name inigma -p8089:80 -itd inigma
docker logs inigma -f
