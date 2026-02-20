import jwt from "jsonwebtoken";

export const refershtoken=(user)=>{
    return jwt.sign({id:user._id,email:user.email},process.env.REFRESH_SECRET,{expiresIn:"2d"})
}
export const accessoken=(user)=>{
    return jwt.sign({id:user._id,email:user.email,role:user.Role,name:user.name},process.env.ACCESS_SECRET,{expiresIn:"60m"})
}