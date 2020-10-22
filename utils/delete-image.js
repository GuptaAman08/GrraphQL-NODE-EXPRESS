const fs = require('fs')
const path = require('path')

module.exports = (filepath) => {
    imagePath = path.join(__dirname, "..", filepath)
    fs.unlink(imagePath, (err) => {
        if (err){
            console.log(imagePath)
            console.log('Error in file deletion', err)
        }
    })
}