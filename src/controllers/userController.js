const User = require("../models/User");


exports.getUserProfile = async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email }).select("-id -__v -createdAt -updatedAt");
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json(user);
  } catch (error) {
    console.error("Get user profile error:", error);
    res.status(500).json({ error: error.message });
  }
};
exports.createUserProfile = async (req, res) => {
  try {
    const { fullName, gender, specialization, softSkills, techSkills, qualification, dob } = req.body;
    const user = await User.findOne({ email: req.body.email });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    user.fullName = fullName;
    user.gender = gender;
    user.specialization = specialization;
    user.softSkills = softSkills;
    user.techSkills = techSkills;
    user.qualification = qualification;
    user.dob = dob;
    user.FTL = false;
    await user.save();
    res.json({
      message: `User profile ${user.email} updated successfully`
    });
  } catch (error) {
    console.error("Create user profile error:", error);
    res.status(500).json({ error: error.message });
  }
};
