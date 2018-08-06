#!/bin/sh
cd ./ballots-tp
sudo docker build -t bitagora/ballots-tp:0.1.0 . && sudo docker push bitagora/ballots-tp:0.1.0
cd ../polls-tp
sudo docker build -t bitagora/polls-tp:0.1.0 . && sudo docker push bitagora/polls-tp:0.1.0
cd ../shell
sudo docker build -t bitagora/shell:0.1.0 . && sudo docker push bitagora/shell:0.1.0
cd ../../../sawtooth-core
sudo docker build -f rest_api/Dockerfile-installed -t bitagora/rest-api:0.1.0 . && sudo docker push bitagora/rest-api:0.1.0