exports.customError = (err, status) => {
    const error = new Error(err)
    error.statusCode = status
    
    return error
}