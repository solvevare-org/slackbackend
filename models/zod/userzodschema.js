import { z } from "zod";

const userzodschema=z.object({
    name:z.string().min(5),
    // email:z.email().toLowerCase(),
    email:z.string().regex(/\S+@\S+\.\S+/).toLowerCase(),
    password:z.string().min(6),
    Role:z.enum(["Developer","Sales"])
})
export default userzodschema