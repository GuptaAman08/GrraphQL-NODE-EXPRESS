const bcrypt = require('bcryptjs')
const validator = require("validator")
const jwt = require('jsonwebtoken')

const User = require('../models/user')
const Post = require('../models/post')
const { customError } = require('../utils/generate-custom-erros')
const deleteImage = require('../utils/delete-image')

module.exports = {
    createUser: async ({ userInput }, req) => {
        const errors = []
        if (!validator.isEmail(userInput.email)){
            errors.push({message: "Invalid Email Id"})
        }

        if (validator.isEmpty(userInput.password) || !validator.isLength(userInput.password, {min: 5})){
            errors.push({message: "Pwd is Too Short"})
        }

        if (errors.length > 0) {
            const err = customError("Invalid Input", 422)
            err.data = errors
            throw err
        }

        const existingUser = await User.findOne({email: userInput.email})

        if (existingUser){
            throw customError("User Already Exists", 422)
        }
        
        const hashedPwd = await bcrypt.hash(userInput.password, 12)

        const user = new User({
            email: userInput.email,
            password: hashedPwd,
            name: userInput.name
        })

        const createdUser = await user.save()
        
        return {
            ...createdUser._doc,
            _id: createdUser._id.toString()
        }
    },
    
    login: async ({ email, password }) => {
        const user = await User.findOne({email: email})
        if (!user){
            throw customError("Invalid Username or Password", 401)
        }

        const isEqual = await bcrypt.compare(password, user.password)
        if (!isEqual){
            throw customError("Invalid Username or Password", 401)
        }

        const token = jwt.sign({
                userId: user._id.toString(),
                email: user.email
            }, 
            process.env.JSON_WEB_TOKEN_SECRET_KEY,
            {
                expiresIn: "1h"
            }
        )

        return {
            token: token,
            userId: user._id.toString()
        }
    },

    createPost: async ({ postInput }, req) => {
        if (!req.isAuth){
            throw customError("Not Authenticated!!", 401)
        }

        const errors = []
        if (validator.isEmpty(postInput.title) || !validator.isLength(postInput.title, {min: 5})){
            errors.push({message: "Title is Invalid"})
        }
        if (validator.isEmpty(postInput.content) || !validator.isLength(postInput.content, {min: 5})){
            errors.push({message: "Content is Invalid"})
        }

        if (errors.length > 0) {
            const err = customError("Invalid Input", 422)
            err.data = errors
            throw err
        }

        
        const user = await User.findById(req.userId)
        if (!user){
            throw customError("Invalid User", 401)
        }
        
        const post = new Post({title: postInput.title, content: postInput.content, imageUrl: postInput.imageUrl, creator: user})
        // add posts to Users list
        
        const createdPost = await post.save()
        
        user.posts.push(post)
        await user.save()
        
        return {
            ...createdPost._doc, 
            _id: createdPost._id.toString(), // Because you can't pass directly mongodb ID object in response since graphql does not understands it.
            createdAt: createdPost.createdAt.toISOString(), // Same reason as above comment
            updatedAt: createdPost.updatedAt.toISOString()
        }
    },

    posts: async ({ pageNo }, req) => {
        if (!req.isAuth){
            throw customError("Not Authenticated!!", 401)
        }

        if (!pageNo){
            pageNo = 1
        }
        // Two items per page
        const perPage = 2

        const totalPosts = await Post.find().countDocuments()
        const posts = await Post.find()
                        .sort({createdAt: - 1})
                        .skip((pageNo - 1 ) * perPage)
                        .limit(perPage)
                        .populate("creator")

        // console.log('posts',totalPosts)
        return {
            posts: posts.map(p => {
                return {
                    ...p._doc, 
                    _id: p._id.toString(),
                    createdAt: p.createdAt.toISOString(),
                    updatedAt: p.updatedAt.toISOString()
                }
            }),
            totalPosts: totalPosts
        }
    },

    post: async ({ id }, req) => {
        if (!req.isAuth){
            throw customError("Not Authenticated!!", 401)
        }

        const post = await Post.findById(id).populate("creator")

        if (!post){
            throw customError("Post not found", 404)
        }

        return {
            ...post._doc,
            _id: post._id.toString(),
            createdAt: post.createdAt.toISOString(),
            updatedAt: post.updatedAt.toISOString()
        }
    },

    updatePost: async ({ id, postInput }, req) => {
        if (!req.isAuth){
            throw customError("Not Authenticated!!", 401)
        }

        const post = await Post.findById(id).populate("creator")

        if (!post){
            throw customError("Post not found", 404)
        }

        if (post.creator._id.toString() !== req.userId.toString()){
            throw customError("Not Authorized", 403)
        }

        const errors = []
        if (validator.isEmpty(postInput.title) || !validator.isLength(postInput.title, {min: 5})){
            errors.push({message: "Title is Invalid"})
        }
        if (validator.isEmpty(postInput.content) || !validator.isLength(postInput.content, {min: 5})){
            errors.push({message: "Content is Invalid"})
        }

        if (errors.length > 0) {
            const err = customError("Invalid Input", 422)
            err.data = errors
            throw err
        }

        post.title = postInput.title
        post.content = postInput.content
        
        if (postInput.imageUrl !== "undefined"){
            post.imageUrl = postInput.imageUrl
        }

        const updatedPost = await post.save()

        return {
            ...updatedPost._doc,
            _id: updatedPost._id.toString(),
            createdAt: updatedPost.createdAt.toISOString(),
            updatedAt: updatedPost.updatedAt.toISOString()
        }
    },

    deletePost: async ({ id }, req) => {
        if (!req.isAuth){
            throw customError("Not Authenticated!!", 401)
        }

        const post = await Post.findById(id)
        if (!post){
            throw customError("Post not found", 404)
        }
        
        if (post.creator.toString() !== req.userId/** req.userId.toString() **/){
            throw customError("Not Authorized", 403)
        }
        
        deleteImage(post.imageUrl)
        
        await Post.findByIdAndRemove(id)
        
        const user = await User.findById(req.userId)
        // console.log('USER', user)
        user.posts.pull(id)
        await user.save()

        return true
    },

    user: async (args, req) => {
        if (!req.isAuth){
            throw customError("Not Authenticated!!", 401)
        }

        const user = await User.findById(req.userId)
        if (!user){
            throw customError("User not found", 404)
        }

        return {
            ...user._doc,
            _id: user._id.toString()
        }
    },

    updateStatus: async ({ status }, req) => {
        if (!req.isAuth){
            throw customError("Not Authenticated!!", 401)
        }

        const user = await User.findById(req.userId)
        if (!user){
            throw customError("User not found", 404)
        }

        user.status = status
        await user.save()

        return {
            ...user._doc,
            _id: user._id.toString()
        }
    }
}