const jwt = require('jsonwebtoken')

module.exports = (req, res, next) => {
    const authHeader = req.get("Authorization")
    if (!authHeader){
        req.isAuth = false
        return next()
    }
    const token = authHeader.split(" ")[1]
    let decodeToken;

    try {
        decodeToken = jwt.verify(token, process.env.JSON_WEB_TOKEN_SECRET_KEY)
    } catch (err) {
        req.isAuth = false
        return next()
    }

    // This if block gets execute when jwt cannot decode the token
    if (!decodeToken){
        req.isAuth = false
        return next()
    }

    req.userId = decodeToken.userId
    req.isAuth = true
    // console.log(req.isAuth)
    next()
}