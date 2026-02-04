import userzodschema from "../models/zod/userzodschema.js"

const validate=(schema)=>async(req,res,next)=>{
    try {
        const data=req.body
      await  schema.parse(data)
        next()
    } catch (error) {
        res.json({msg:"zod validation error",er:error})
    }
}
export default validate