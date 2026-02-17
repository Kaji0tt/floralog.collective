#!/bin/bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash -
sudo apt update && sudo apt-get install -y nodejs
npm install #install all dependencies from pacakge.json