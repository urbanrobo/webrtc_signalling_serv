//require our websocket library 
const WebSocketServer = require('ws').Server;
const {Observable, interval, timeout, map, ignoreElements, mergeWith} = require("rxjs");

// send periodic pings to cars and drivers to make sure they are still alive
const PING_INTERVAL = 5000;
//after PING_TIMEOUT milliseconds we consider client unresponsive and disconnect session
const PING_TIMEOUT = 10000;
const WEBSOCKET_PORT = 3000;

const wss = new WebSocketServer({port: WEBSOCKET_PORT});

//all connected to the server users
// key: connection id
// value: connection
const users = {};
const vehicles = {};

let globalConnectionId = 0;

function pongRx(connection) {
    // no idea why fromEvent doesnt work for connection.on('pong')
    return new Observable(subscriber => {
        let listener = x => subscriber.next(x);
        connection.addListener('pong', listener);
        return () => connection.removeListener('pong', listener);
    });
}

//when a user connects to our sever
wss.on('connection', function (connection) {
    let cid = globalConnectionId++;
    console.log("User connected", cid);

    //when server gets a message from a connected user
    connection.on('message', function (message) {

        let data = {};
        //accepting only JSON messages
        try {
            data = JSON.parse(message);
        } catch (e) {
            console.log("Invalid JSON");
        }

        //switching type of the user message
        switch (data.action) {
            //when a user tries to login

            case "login":
                console.log("User logged", data.name);

                //if anyone is logged in with this username then refuse

                //save user connection on the server
                connection.name = data.name;

                if (data.type === "vehicle") {
                    vehicles[cid] = connection;
                    broadcastVehicleList();
                } else {
                    users[cid] = connection;
                    sendTo(connection, {
                        action: "vehicle_list",
                        vehicles: Object.values(vehicles).map(car => car.name),
                    });
                }

                break;

            case "connect":
                Object.values(vehicles).filter(conn => conn.name === data.name).forEach(conn => {
                    if (conn != null) {
                        console.log("Sending connect to " + data.name);

                        sendTo(conn, {
                            action: "connect",
                            name: connection.name
                        });
                    }
                })
                break;

            case "relay":
                //for ex. UserA wants to call UserB
                console.log("Relaying msg to: ", data.name);

                //if UserB exists then send him offer details
                Object.values(users).filter(conn => conn.name === data.name).forEach(conn => {
                        if (conn == null) {
                            conn = vehicles[data.name];
                        }

                        if (conn != null) {
                            //setting that UserA connected with UserB
                            connection.otherName = data.name;

                            sendTo(conn, {
                                action: "relay",
                                type: data.type,
                                message: data.message,
                                name: connection.name
                            });
                        }
                    }
                )
                break;

            case "logout":
                console.log("Logout: ", data.name, cid);
                if (cid in users) {
                    delete users[cid];
                    broadcastUserList();
                } else if (cid in vehicles) {
                    delete vehicles[cid];
                    broadcastVehicleList();
                }
                break;

            case "bye":
                console.log("Sending bye to ", data.name);
                Object.values(vehicles).filter(conn => conn.name === data.name).forEach(conn => {
                    sendTo(conn, {
                        action: "bye"
                    });
                })
                break;
            default:
                console.log("Command not found", data.action);
                break;
        }
    });

    //when user exits, for example closes a browser window
    //this may help if we are still in "offer","answer" or "candidate" state
    let onClose = function () {
        if (connection.pingsub) {
            connection.pingsub.unsubscribe();
        }
        connection.removeAllListeners('message');
        connection.removeAllListeners('close');
        if (cid in users) {
            console.log("Connection lost: ", connection.name, cid);
            delete users[cid];
            broadcastUserList();
        }

        if (cid in vehicles) {
            console.log("Connection lost: ", connection.name, cid);
            delete vehicles[cid];
            broadcastVehicleList();
        }
    };
    connection.on("close", onClose);

    connection.pingsub = interval(PING_INTERVAL).pipe(
        map(it => connection.ping(`ping${cid}-${it}`)),
        ignoreElements(),
        mergeWith(pongRx(connection)),
        timeout(PING_TIMEOUT)
    ).subscribe(next => {
    }, error => {
        console.log('pong timeout, client unresponsive', connection.name, cid);
        onClose();
    })

});

function sendTo(connection, obj) {
    connection.send(JSON.stringify(obj));
}

function broadcastVehicleList() {
    let vehicleIds = Object.values(vehicles).map(conn => conn.name)
    Object.values(users).forEach(userconn => {
        sendTo(userconn, {
            action: "vehicle_list",
            vehicles: vehicleIds,
        })
    });
}

function broadcastUserList() {
    let userIds = Object.values(users).map(conn => conn.name);
    Object.values(vehicles).forEach(carconn => {
        sendTo(carconn, {
            action: "user_list",
            users: userIds,
        })
    });
}
