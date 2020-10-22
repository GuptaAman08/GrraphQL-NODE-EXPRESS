const jwt = require('jsonwebtoken')
const { customError } = require('../utils/generate-custom-erros')

module.exports = (req, res, next) => {
    const authHeader = req.get("Authorization")
    if (!authHeader){
        throw customError("Authentication Failed", 401)
    }
    const token = authHeader.split(" ")[1]
    let decodeToken;

    try {
        decodeToken = jwt.verify(token, process.env.JSON_WEB_TOKEN_SECRET_KEY)
    } catch (err) {
        // When any technical error occured
        if (!err.statusCode){
            err.statusCode = 500
        }
        throw err
    }

    // This if block gets execute when jwt cannot decode the token
    if (!decodeToken){
        throw customError("Authentication Failed", 401)
    }

    req.userId = decodeToken.userId
    next()
}