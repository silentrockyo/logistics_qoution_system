import mongoose from "mongoose";

const connectDb = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not set");
  }
  await mongoose.connect(uri);
  console.log("MongoDB connected");
};

export default connectDb;
