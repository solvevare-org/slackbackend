import {connect} from "mongoose";

const dbConnect=async()=>{
        try {
           await connect(process.env.MONGO_URI)
            console.log("db connected")
        } catch (error) {
            console.log("db error"+error)
        }
}

export default dbConnect