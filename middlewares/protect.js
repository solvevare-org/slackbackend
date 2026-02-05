import jwt from "jsonwebtoken";
const protect=(req,res,next)=>{
    try {
        const beartoken= req.headers.authorization
    const token=beartoken.split(" ")
    const actualtokn=token[1]
      const result=  jwt.verify(actualtokn,process.env.ACCESS_SECRET)
       req.user = result
       next()
    } catch (error) {
        res.json({msg:"unAutherized Access"})
    }
}
export default protect