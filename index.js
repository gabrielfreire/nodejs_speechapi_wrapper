const express = require('express');
const app = express();
const port = (process.env.PORT || 3000);
const cors = require('cors');
const bodyParser = require('body-parser');
const SpeechService = require('./services/speech');

let server = app.listen(port, function() {
    console.log('Server start on port', port);
});
//socket instance
const io = require('socket.io')(server);
io.set('origins', '*:*');

let speechApi = new SpeechService(io);

app.use(cors({ credentials: true }));
app.use(bodyParser.json());
