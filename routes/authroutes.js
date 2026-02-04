

import { Router } from "express";
import { login, refresh, register } from "../controllers/authController.js";
import validate from "../middlewares/validate.js";
import userzodschema from "../models/zod/userzodschema.js";
const authroutes=Router()

//sign up
authroutes.post("/signup",validate(userzodschema),register)//apply middleware

//log in 
authroutes.post("/login",login)


authroutes.get("/refresh",refresh)
export default authroutes