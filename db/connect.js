import mongoose from "mongoose";

const dbConnect = async () => {
    try {
        const uri = process.env.MONGO_URI;
        if (!uri) {
            console.error('MONGO_URI not set in environment');
            process.exit(1);
        }

        await mongoose.connect(uri, {
            maxPoolSize: 10,        // connection pool - reuse connections
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            connectTimeoutMS: 10000,
            bufferCommands: false,  // fail fast instead of buffering
        });

        console.log('MongoDB connected');

        mongoose.connection.on('error', (err) => {
            console.error('MongoDB connection error:', err);
        });

        mongoose.connection.on('disconnected', () => {
            console.warn('MongoDB disconnected');
        });

    } catch (error) {
        console.error('Failed to connect to MongoDB:', error);
        process.exit(1);
    }
};

export default dbConnect;