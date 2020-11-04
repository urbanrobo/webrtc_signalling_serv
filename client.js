
const WebSocket = require('ws');
 
const ws = new WebSocket('ws://localhost:3000');

ws.on('open', function open() {
    ws.send(JSON.stringify({
        type: 'user',
        name: 'URBO',
        action: 'login'
    }));
  });
   
  ws.on('message', function incoming(data) {
    console.log(data);
  });
