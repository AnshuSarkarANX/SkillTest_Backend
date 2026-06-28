import mongoose from "mongoose";
import experienceItemSchema from "./ExperienceItem.js";
const experienceSchema = new mongoose.Schema({
    experiences: {
        type: [experienceItemSchema],
        default: [],
    },
    
},
{_id: false})

export default experienceSchema;