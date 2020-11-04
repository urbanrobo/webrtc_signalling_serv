//require our websocket library 
var WebSocketServer = require('ws').Server;
 
//creating a websocket server at port 9090 
var wss = new WebSocketServer({port: 3000}); 

//all connected to the server users 
var users = {};
var vehicles = {};

//when a user connects to our sever 
wss.on('connection', function(connection) {
  
   console.log("User connected");
	
   //when server gets a message from a connected user
   connection.on('message', function(message) { 
	
      var data; 
      //accepting only JSON messages 
      try {
         data = JSON.parse(message); 
      } catch (e) { 
         console.log("Invalid JSON"); 
         data = {}; 
      } 
		
      //switching type of the user message 
      switch (data.action) { 
         //when a user tries to login 
			
         case "login": 
            console.log("User logged", data.name); 
				
            //if anyone is logged in with this username then refuse 

               //save user connection on the server
               connection.name = data.name; 

               if(data.type == "vehicle") {
                    vehicles[data.name] = connection;
                    for (name in users) {
                        sendTo(users[name], {
                            action: "vehicle_list",
                            vehicles: Object.keys(vehicles),
                        })
                    }

               } else {
                    users[data.name] = connection;
                    sendTo(connection, { 
                        action: "vehicle_list",
                        vehicles: Object.keys(vehicles),
                     }); 
               }
				
            break;

         case "connect":
            var conn = vehicles[data.name];
            if(conn != null) { 
                console.log("Sending connect to " + data.name);

            sendTo(conn, { 
                action: "connect", 
                name: connection.name 
             }); 
            }
             break;
				
         case "relay": 
            //for ex. UserA wants to call UserB 
            console.log("Relaying msg to: ", data.name); 
				
            //if UserB exists then send him offer details 
            var conn = users[data.name];
            if (conn == null) {
                conn = vehicles[data.name];
            }
				
            if(conn != null) { 
               //setting that UserA connected with UserB 
               connection.otherName = data.name; 
					
               sendTo(conn, { 
                  action: "relay", 
                  type: data.type,
                  message: data.message, 
                  name: connection.name 
               }); 
            } 
				
            break;  
				
        //  case "answer": 
        //     console.log("Sending answer to: ", data.name); 
        //     //for ex. UserB answers UserA 
        //     var conn = users[data.name]; 
				
        //     if(conn != null) { 
        //        connection.otherName = data.name; 
        //        sendTo(conn, { 
        //           type: "answer", 
        //           answer: data.answer 
        //        }); 
        //     } 
				
        //     break;  
				
        //  case "candidate": 
        //     console.log("Sending candidate to:",data.name); 
        //     var conn = users[data.name];  
				
        //     if(conn != null) { 
        //        sendTo(conn, { 
        //           type: "candidate", 
        //           candidate: data.candidate 
        //        });
        //     } 
				
        //     break;  
				
         case "leave": 
            console.log("Disconnecting from", data.name); 
            var conn = users[data.name]; 
            // conn.otherName = null; 
				
            //notify the other user so he can disconnect his peer connection 
            if(conn != null) { 
               sendTo(conn, { 
                  action: "leave" 
               }); 
            }  
				
            break;  
                
        case "bye":
            console.log("Sending bye to ", data.name); 
            var conn = vehicles[data.name];
            if(conn != null) { 
                sendTo(conn, { 
                   action: "bye" 
                }); 
             }  
                 
             break;  
             
            
         default: 
            sendTo(connection, { 
               action: "error", 
               message: "Command not found: " + data.type 
            }); 
				
            break; 
      }  
   });  
	
   //when user exits, for example closes a browser window 
   //this may help if we are still in "offer","answer" or "candidate" state 
   connection.on("close", function() { 
	
      if(connection.name) { 
      delete users[connection.name]; 
		
      }
   });  
   //connection.send("Hello world"); 
	
});  

function sendTo(connection, message) { 
   connection.send(JSON.stringify(message)); 
}