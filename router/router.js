import { Router } from "express";
import authroutes from "../routes/authroutes.js";
import userroutes from "../routes/userroutes.js";
import messageroutes from "../routes/messageroutes.js";
import path from 'path'

const router=Router()


//group routing
//before  /signup
router.use("/auth",authroutes)

//after /auth/signup
router.use("/user",userroutes)
router.use("/message", messageroutes)

// serve uploaded files
router.use('/uploads', (req, res, next) => next())

export default router