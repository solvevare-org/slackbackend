import { Router } from "express";
import authroutes from "../routes/authroutes.js";
import userroutes from "../routes/userroutes.js";
import messageroutes from "../routes/messageroutes.js";
import grouproutes from "../routes/grouproutes.js";
import communityroutes from "../routes/communityroutes.js";
import workspaceroutes from "../routes/workspaceroutes.js";
import path from 'path'

const router=Router()


//group routing
//before  /signup
router.use("/auth",authroutes)

//after /auth/signup
router.use("/user",userroutes)
router.use("/message", messageroutes)
router.use("/group", grouproutes)

router.use("/community", communityroutes)
router.use("/workspaces", workspaceroutes)

// serve uploaded files
router.use('/uploads', (req, res, next) => next())

export default router