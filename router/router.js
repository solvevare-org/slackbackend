import { Router } from "express";
import authroutes from "../routes/authroutes.js";
import userroutes from "../routes/userroutes.js";

const router=Router()


//group routing
//before  /signup
router.use("/auth",authroutes)

//after /auth/signup
router.use("/user",userroutes)

export default router