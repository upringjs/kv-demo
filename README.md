# kv-demo

[![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat)](http://standardjs.com/)

Key Value store on top of Upring demo.

See [./bin.js](./bin.js) for exposing upring-kv over HTTP.
This file contains a small http API to get/put data into the
key-value store. Each URL equals to a given key.

To use is, follow these instructions. First, install some
dependencies:

```
npm i kv-demo pino baseswim -g
```

Then, we need to figure out what is our ip.

On Linux:

```sh
export MYIP=`ip addr show wlan0 | grep -Po 'inet \K[\d.]+'`
```

On Mac:

```sh
export MYIP=`ipconfig getifaddr en0`
```

The export phase needs to be done for every opened shell.

Then we can start our upring cluster. We will use a
[baseswim](http://npm.im/baseswim) node to simplify bootstrapping.

```sh
# on one shell
baseswim --host $MYIP --port 7979 | pino
# on another shell
upring-kv -p 3042 $MYIP:7979 | pino
# on another shell
upring-kv -p 3043 $MYIP:7979 | pino
# on another shell
upring-kv -p 3044 $MYIP:7979 | pino
```

Then we can query our key/value storage using basic curl.

```
curl -v localhost:3042
curl -X POST -d 'hello upring' localhost:3043
curl -v localhost:3044
# on another shell
curl localhost:3042?live=true # use SSE to send updates
# one more shell
curl -X POST -d 'by Matteo' localhost:3043
```

<a name="acknowledgements"></a>
## Acknowledgements

This project is kindly sponsored by [nearForm](http://nearform.com).

## License

MIT
