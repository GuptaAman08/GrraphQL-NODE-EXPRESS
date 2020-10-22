const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const mongoose = require('mongoose')

const feedRoutes = require('./routes/feed');
const authRoutes = require('./routes/auth');

require('dotenv').config()

const app = express();

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "images")
    },
    filename: function (req, file, cb) {
        cb(null, new Date().toISOString().replace(/:/g, '-') + "-" + file.originalname)
    }
})

const fileFilter = (req, file, cb) => {
    if ( file.mimetype === "image/jpeg" || file.mimetype === "image/jpg" || file.mimetype === "image/png" ){
        // Pass true to accept only images of particuar type else pass false
        cb(null, true)
    }else{
        cb(null, false)
    }
}

// app.use(bodyParser.urlencoded()); // x-www-form-urlencoded <form>
app.use(bodyParser.json()); // application/json
app.use(multer({ storage: storage, fileFilter: fileFilter}).single("image"));
app.use("/images", express.static(path.join(__dirname, "images")))

app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, GET, POST, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    next();
});

app.use('/feed', feedRoutes);
app.use('/auth', authRoutes);

// Express buitl-in special erro handling middleware
app.use((error, req, res, next) => {
    const status = error.statusCode || 500
    const message = error.message
    const data = error.data
    res.status(status).json({
        message: message,
        data: data
    })
})

mongoose.connect('mongodb+srv://aman:snZ5L0a4JMbsXqWG@primary.u62r1.mongodb.net/feeds?retryWrites=true&w=majority', {useUnifiedTopology: true, useNewUrlParser: true})
.then(res => {
    console.log('Http Server Ready')
    const server = app.listen(8080);

    const io = require('./socket').init(server)

    //whenever a new client connexts to us.
    io.on("connection", socket => {
        console.log('Client Connected')
    })
})
.catch(err => {
    console.log('Connection Error', err)
})