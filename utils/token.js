import jwt from "jsonwebtoken";

export const refershtoken=(user)=>{
    return jwt.sign({id:user._id,email:user.email},process.env.REFRESH_SECRET,{expiresIn:"25m"})
}
export const accessoken=(user)=>{
    return jwt.sign({id:user._id,email:user.email},process.env.ACCESS_SECRET,{expiresIn:"5m"})
}