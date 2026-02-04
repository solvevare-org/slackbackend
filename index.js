

import express, { Router } from "express";
import dotenv from "dotenv";
import router from "./router/router.js";
import dbConnect from "./db/connect.js";
import cookie from "cookie-parser";
dotenv.config()
const app=express()
app.use(express.json())
app.use(cookie())



app.use(router)
dbConnect().then(()=>{
app.listen(process.env.PORT,()=>{
    console.log(`server running `+process.env.PORT)
})
})
