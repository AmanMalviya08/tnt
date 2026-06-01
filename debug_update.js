const mongoose = require('mongoose');
const dotenv = require('dotenv');
const { tourModel } = require('./src/models/tourModel');

dotenv.config();

const MONGO_URI = process.env.MONGODB_URL || "mongodb://localhost:27017/tour-travels";

async function debugUpdate() {
    await mongoose.connect(MONGO_URI);

    try {
        const tour = await tourModel.create({
            tourName: "Debug Tour " + Date.now(),
            cityId: new mongoose.Types.ObjectId(),
            startDate: new Date(),
            endDate: new Date(),
            totalSeats: 10,
            seatsPerRow: 4,
        });
        console.log("Tour created with 10 seats.");

        // 1. Update without explicit $set
        console.log("Updating to 12 (Implicit $set)...");
        await tourModel.findOneAndUpdate(
            { _id: tour._id },
            { totalSeats: 12 },
            { new: true }
        );

        const t1 = await tourModel.findById(tour._id);
        console.log("Result seats length:", t1.seats.length);

        // Cleanup
        await tourModel.findByIdAndDelete(tour._id);
    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.connection.close();
    }
}

debugUpdate();
