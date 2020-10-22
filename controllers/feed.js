const { validationResult } = require('express-validator/check')
const Post = require('../models/post')
const User = require('../models/user')
const { customError } = require('../utils/generate-custom-erros')
const deleteImage = require('../utils/delete-image')
const io = require('../socket')

exports.getPosts = async (req, res, next) => {
    const currentPage = req.query.page
    const itemsPerPage = 2
    
    try {
        let totalPages = await Post.find().countDocuments()
            
        let posts = await Post.find()
                        .populate('creator')
                        .sort({createdAt: -1})
                        .skip((currentPage - 1) * itemsPerPage)
                        .limit(itemsPerPage)
        
        
        res.status(200).json({
            message: "Fetched all posts",
            posts: posts,
            totalItems: totalPages
        })

    } catch (err) {
        if (!err.statusCode){
            err.statusCode = 500
        }
        return next(err)   
    }
};

exports.createPost = async (req, res, next) => {
    const title = req.body.title;
    const content = req.body.content;

    const errors = validationResult(res)

    // console.log(errors)
    if (!errors.isEmpty()){
        // No need to put error inside next() since this block of code is synchronous. the express error handling middleware you contructed will then be called automatically.
        throw customError("Validation Failed. Entered incorrsct data", 422)
    }
    
    if (!req.file){
        throw customError("Image not present", 422)
    }

    // console.log(req.file)
    const imageUrl = "/" + req.file.path.replace(/\\/g, "/")

    const post = new Post({
        title: title, 
        content: content,
        imageUrl: imageUrl,
        creator: req.userId
    })

    try {
        await post.save()
        
        const user = await User.findById(req.userId)
        user.posts.push(post)
    
        await user.save()
        
        io.getIO().emit("posts", {
            action: "create",
            post: post,
            creator: {
                _id: req.userId,
                name: user.name
            }
        })

        res.status(201).json({
            message: 'Post created successfully!',
            post: post,
            creator: {_id: user._id, name: user.name}
        });
    } catch (err) {
        if (!err.statusCode){
            err.statusCode = 500
        }
        return next(err)
    }
};

exports.getPost = async (req, res, next) => {
    const postId = req.params.postId

    try {
        const post = await Post.findById(postId)

        if (!post){
            throw customError("Could not find post", 404)
        }

        res.status(200).json({
            message: "Post Fetched successfully",
            post: post
        })

    } catch (err) {
        if (!err.statusCode){
            err.statusCode = 500
        }
        return next(err)   
    }
}

exports.updatePost = async (req, res, next) => {
    const postId = req.params.postId

    const errors = validationResult(res)
    if (!errors.isEmpty()){
        throw customError("Validation Failed. Entered incorrsct data", 422)
    }

    const title = req.body.title
    const content = req.body.content

    // this imageUrl var will be set only if no file was choosen by user from frontend.  
    let imageUrl = req.body.image

    // If new file gets uploaded to replace the existing file
    if (req.file){
        imageUrl = "/" + req.file.path.replace(/\\/g, "/")
    }

    if (!imageUrl){
        throw customError("No file Picked", 422)
    }

    try {        
        const post = await Post.findById(postId).populate("creator")
        
        if (!post){
            throw customError("Could not find post", 404)
        }
    
        if (post.creator._id.toString() !== req.userId){
            throw customError("Not Authorization", 403)
        }
    
        if (imageUrl !== post.imageUrl){
            deleteImage(post.imageUrl)
        }
    
        post.title = title,
        post.content = content,
        post.imageUrl = imageUrl
    
        const result = await post.save()
        
        io.getIO().emit("posts", {
            action: "update",
            post: result
        })

        res.status(200).json({
            message: "Post Updated Successfully",
            post: result
        })
    } catch (err) {
        if (!err.statusCode){
            err.statusCode = 500
        }
        return next(err)
    }
}

exports.deletePost = async (req, res, next) => {
    const postId = req.params.postId

    try {        
        const post = await Post.findById(postId)
        if (!post){
            throw customError("Could not find post", 404)
        }
    
        if (post.creator.toString() !== req.userId){
            throw customError("Not Authorization", 403)
        }
    
        deleteImage(post.imageUrl)
        await Post.findByIdAndDelete(postId)
        
        const user = await User.findById(req.userId)
        // mongoose provides pull method to remove element from an array
        user.posts.pull(postId)
    
        await user.save()
        
        io.getIO().emit("posts", {
            action: "delete",
            post: postId
        })

        res.status(200).json({
            message: "Post Deleted"
        })
    } catch (err) {
        if (!err.statusCode){
            err.statusCode = 500
        }
        return next(err)
    }
}