#!/bin/bash

docker build -t inigma .
docker stop inigma
docker rm inigma
#docker run --name inigma -v/opt/inigma/keys:/app/keys -p8585:80 -itd inigma
docker run --name inigma -p8585:80 -itd inigma
docker logs inigma -f
