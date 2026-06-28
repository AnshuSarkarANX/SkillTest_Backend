import mongoose from "mongoose";

const experienceItemSchema = new Mongoose.Schema(
    {
        compoanyName: {
            type: String,
            required: true
        },
        role: {
            type: String,
            required: true },

            timePeriod: {
                type: String,
                required: true,
            },
            description: {
                type: [String],
                required: true,}
        
    }
)
export default experienceItemSchema;