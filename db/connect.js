import mongoose from "mongoose";

const dbConnect = async () => {
    try {
        const uri = process.env.MONGO_URI;
        if (!uri) {
            console.error('MONGO_URI not set in environment');
            process.exit(1);
        }

        // use new connection
        await mongoose.connect(uri, {
            // keep defaults, modern mongoose handles options
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
        // exit process when DB connection fails at startup
        process.exit(1);
    }
};

export default dbConnect;