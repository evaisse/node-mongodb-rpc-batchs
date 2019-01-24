# node-websocket-taskrunner


A RPC batch manager using websocket.
You can add any worker you want to listen to commands.


A **server** is the hub tha will command the workers and connect the clients.

    PORT=3546 websocket-task server

A **worker** is just a listener that check if commands are available in working directory with execution mode
and execute them if it recieved commands from websockets.

let's say : 

    evaisse:~/taskmanager$ ls -l
    -rwxr-xr-x   1 evaisse  staff   127 Jan 24 21:53 test-command.sh
    -rwxr-xr-x   1 evaisse  staff    82 Jan 24 21:59 test-error.sh
    
Loading the worker will be

    evaisse:~/taskmanager$ websocket-task worker

A **runner** is just a basic commanding alias that run the command from remote location.


    $ websocket-task exec --timeout=12 test-command.sh --foo bar
    $ websocket-task exec test-command.sh --foo bar 


       
## future plans

 - Allow running commands from web browser
 - task security through signature
 - request throttling 
 - server-level status & queue management
 - pipe in the stdin