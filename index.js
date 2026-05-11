// Starts Express backend server
const express = require('express');
const app = express();
const cors = require("cors");

app.use(express.json());
app.use(express.static(__dirname + '/static'));
app.use(cors({ origin: '*' }));

// Ping API used to wake the backend server
app.get('/ping', (req, res) => {
    res.json({
        status: 'OK',
        message: 'Server is awake'
    });
});

const port = process.env.PORT || 8080;

app.listen(port, () => console.log(
    `Express started at "http://localhost:${port}"\n` +
    `press Ctrl-C to terminate.`
));
