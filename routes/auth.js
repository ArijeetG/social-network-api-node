const router = require('express').Router()
const bcrypt = require('bcrypt')
const auth = require('./verifyToken')
const jwt = require('jsonwebtoken')
const { createUser, loginByEmail,changePassword } = require('./utils/queries')


router.post('/register', createUser)
router.post('/login', loginByEmail)
router.post('/changePassword',auth,changePassword)

module.exports = router