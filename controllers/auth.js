const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { validationResult } = require('express-validator/check')

const { customError } = require('../utils/generate-custom-erros')
const User = require('../models/user')


exports.signup = async (req, res, next) => {
    const errors = validationResult(req)

    if (!errors.isEmpty()){
        return next(customError("Validation Failed.", 422))
    }

    const email = req.body.email
    const password = req.body.password
    const name = req.body.name

    try {
        const hashedPwd = await bcrypt.hash(password, 12)
        const user = new User({
            email: email,
            password: hashedPwd,
            name: name
        })
    
        const result = await user.save()

        res.status(201).json({
            message: "User Created",
            userId: result._id
        })
        
    } catch (err) {
        if (!err.statusCode){
            err.statusCode = 500
        }
        return next(err)    
    }
}   

exports.login = async (req, res, next) => {
    const email = req.body.email
    const password = req.body.password

    try {
        const user = await User.findOne({email: email})
        if (!user){
            throw customError("User ALready Exists", 401)
        }
    
        const isEqual = await bcrypt.compare(password, user.password)
        
        if ( !isEqual){
            throw customError("Authentication Failed", 401)
        }
    
        const token = jwt.sign({
                email: email,
                userId: user._id.toString()
            },
            process.env.JSON_WEB_TOKEN_SECRET_KEY,
            {expiresIn: "1h"}
        )
    
        res.status(200).json({token: token, userId: user._id.toString()})
    } catch (err) {
        if (!err.statusCode){
            err.statusCode = 500
        }
        return next(err)
    }

}

exports.getUserStatus = async (req, res, next) => {
    try {
        const user = await User.findById(req.userId)
    
        if (!user){
            throw customError("User Not Found", 404)
        }
        res.status(200).json({
            status: user.status
        })
    } catch (err) {
        if (!err.statusCode){
            err.statusCode = 500
        }
        return next(err)
    }
}

exports.updateUserStatus = async (req, res, next) => {
    const newStatus = req.body.status

    try {
        const user = await User.findById(req.userId)
        if (!user){
            throw customError("User Not Found", 404)
        }
    
        user.status = newStatus
    
        await user.save()
        res.status(200).json({
            message: "User Status Updated"
        })
    } catch (err) {
        if (!err.statusCode){
            err.statusCode = 500
        }
        return next(err)
    }

}