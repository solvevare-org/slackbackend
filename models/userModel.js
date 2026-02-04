

import { Schema,model } from "mongoose";
import bcryptjs from "bcryptjs";
const userSchema = new Schema({
  name: {
    type: String,
    required: [true, "Name is required"],
    minlength: [5, "Name must have at least 5 letters"]
  },
  email: {
    type: String,
    required: [true, "Email is required"],
    unique: true,
    lowercase: true,
    match: [/\S+@\S+\.\S+/, "Please provide a valid email address"]
  },
  password: {
    type: String,
    required: [true, "Password is required"],
    minlength: [6, "Password must be at least 6 characters long"]
  },
  Role: {
    type: String,
    required: [true, "Role is required"],
    enum: {
      values: ["Developer", "Sales"],
      message: "Role must be either 'Developer' or 'Sales'"
    }
  }
});

userSchema.pre("save" ,async function(next){
  //password hash
const salt=await bcryptjs.genSalt(10)
this.password=await bcryptjs.hash(this.password,salt)
next()
})

const User=model("user",userSchema)
export default User
