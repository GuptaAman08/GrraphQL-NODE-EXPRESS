const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const mongoose = require('mongoose')
const { graphqlHTTP } = require('express-graphql')

const graphqlSchema = require("./graphql/schema")
const graphqlResolver = require("./graphql/resolvers")
const authMiddleware = require("./middleware/auth")
const deleteImage = require('./utils/delete-image')

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

    if (req.method === "OPTIONS"){
        return res.sendStatus(200)
    }
    
    next();
});

app.use(authMiddleware)

app.put("/post-image", (req, res, next) => {
    if (!req.isAuth){
        throw new Error("Not Authenticated")
    }

    if (!req.file){
        return res.status(200).json({message: "File not provided"})
    }

    if (req.body.oldPath){
        deleteImage(req.body.oldPath)
    }

    return res.status(201).json({message: "File Stored", filePath: "/" + req.file.path.replace(/\\/g, "/")})
})

app.use("/graphql", graphqlHTTP({
    schema: graphqlSchema,
    rootValue: graphqlResolver,
    graphiql: true,
    customFormatErrorFn(err) {
        if (!err.originalError){
            return err
        }
        const data = err.originalError.data
        const message = err.originalError.message || "An Error Occured"
        const statusCode = err.originalError.statusCode || 500

        return {
            message: message,
            status: statusCode,
            data: data
        }
    }
}))

// Express buitl-in special erro handling middleware
app.use((error, req, res, next) => {
    console.log('Inside error handling functon')
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
    console.log('Connected')
    app.listen(8080);
})
.catch(err => {
    console.log('Connection Error', err)
})