import User from "../models/userModel.js"
import bcryptjs from "bcryptjs";
import jwt from "jsonwebtoken";
import { accessoken, refershtoken } from "../utils/token.js";
export const register=async(req,res)=>{
    try {
      // console.log(req.body)
      const data= new User(req.body)//save or validate
     await data.save()//send to database 
     res.json({msg:"register successfull...."})
    } catch (error) {
        res.json({msg:error})
    }
}
export const login=async(req,res)=>{
   try {

    // const email=req.body.email
    const {email,password}=req.body
   
    //email find
      const result= await User.findOne({email})
      if(!result) return res.json({msg:"invalid credentials"})
    //password match
      const match= await  bcryptjs.compare(password,result.password)
      if(!match) return res.json({msg:"invalid credentials"})
       
      
       //token generate

      const a= refershtoken(result)
      const b= accessoken(result)
      res.cookie("refcookie",a)

      res.json({msg:"login successfull.....",access:b})
      console.log("Login successful:", result.email, b)


   


   } catch (error) {
    res.json({msg:"some error"})
   }
}

export const refresh=(req,res)=>{
try {
    const refcookie=req.cookies.refcookie
    const result=jwt.verify(refcookie,process.env.REFRESH_SECRET)
    const newaccess=jwt.sign({id:result.id,email:result.email},process.env.ACCESS_SECRET,{expiresIn:"25s"})
    res.json({access:newaccess})
} catch (error) {
  res.json({msg:"invalid cookie"})
}


}