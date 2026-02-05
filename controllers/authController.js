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

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ msg: 'Email and password required' })

    const lookupEmail = String(email).toLowerCase()
    const result = await User.findOne({ email: lookupEmail });
    if (!result) {
      return res.status(400).json({ msg: "Invalid credentials" });
    }

    const match = await bcryptjs.compare(password, result.password);
    if (!match) {
      return res.status(400).json({ msg: "Invalid credentials" });
    }

    const refresh = refershtoken(result);
    const access = accessoken(result);

    res.cookie("refcookie", refresh, { httpOnly: true });

    res.status(200).json({
      msg: "Login successful",
      access,
      user: {
        id: result._id,
        email: result.email,
        name: result.name,
        role: result.Role
      },
    });

  } catch (error) {
    res.status(500).json({ msg: "Server error" });
  }
};


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