#!/bin/sh

openssl req -new -nodes -newkey rsa:2048 -keyout "keys/$1.key" -out "keys/$1.csr" -subj "/C=US/ST=$1"
openssl x509 -req -sha256 -days 300 -in "keys/$1.csr" -CA RootCA.pem -CAkey RootCA.key -CAcreateserial -extfile "configs/$1.ext" -out "certs/$1.crt"
