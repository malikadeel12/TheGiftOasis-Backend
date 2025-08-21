import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  email: { type: String, required: true },
  password: { type: String, required: true },
   role: { type: String, enum: ["user","admin"], default: "user" },
  firstName: String,
  lastName: String,
  address: String,
  country: String,
  state: String,
  city: String,
  prefix: String,
  phone: String,
  zip: String
});

const User = mongoose.model("User", userSchema);

export default User;
