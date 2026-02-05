

import { Router } from "express";
import { login, refresh, register } from "../controllers/authController.js";
import validate from "../middlewares/validate.js";
import userzodschema from "../models/zod/userzodschema.js";
import protect from "../middlewares/protect.js";
import { createInvite, validateInvite, acceptInviteRegister, previewInvite } from "../controllers/inviteController.js";
const authroutes=Router()

//sign up
authroutes.post("/signup",validate(userzodschema),register)//apply middleware

//log in 
authroutes.post("/login",login)


authroutes.get("/refresh",refresh)
// invite routes
authroutes.post('/invite', protect, createInvite)
authroutes.get('/invite/validate', validateInvite)
authroutes.post('/invite/accept', acceptInviteRegister)
authroutes.get('/invite/preview', protect, previewInvite)
export default authroutes