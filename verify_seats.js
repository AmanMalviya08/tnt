const mongoose = require('mongoose');
const dotenv = require('dotenv');
const { tourModel } = require('./src/models/tourModel');
const { bookingModel } = require('./src/models/bookingModel');

dotenv.config();

const MONGO_URI = process.env.MONGODB_URL || "mongodb://localhost:27017/tour-travels";

async function verifySeats() {
    console.log("Connecting to DB:", MONGO_URI); // Only log non-sensitive part if possible? 
    // It's a test script, user sees output. 
    await mongoose.connect(MONGO_URI);
    console.log("Connected.");

    try {
        const cityId = new mongoose.Types.ObjectId();
        const packageId = new mongoose.Types.ObjectId();
        const userId = new mongoose.Types.ObjectId();

        // 2. Create a Tour with seats
        console.log("Creating Tour...");
        const tour = await tourModel.create({
            tourName: "Test Bus Tour " + Date.now(),
            cityId,
            packageId,
            startDate: new Date(Date.now() + 86400000),
            endDate: new Date(Date.now() + 172800000),
            transportType: "Bus",
            totalSeats: 10,
            seatsPerRow: 4,
        });
        console.log(`Tour created: ${tour._id}`);

        // 3. Update Tour seats (resize)
        console.log("Updating Tour totalSeats to 12...");
        const updatedTour = await tourModel.findOneAndUpdate(
            { _id: tour._id },
            { $set: { totalSeats: 12 } },
            { new: true }
        );
        // console.log("Updated Tour Seats:", updatedTour.seats);
        if (updatedTour.seats.length !== 12) throw new Error(`Seats resize failed. Expected 12, got ${updatedTour.seats.length}`);
        console.log("Seats resized to 12.");

        // Cleanup
        await tourModel.findByIdAndDelete(tour._id);

    } catch (error) {
        console.error("Verification Failed:", error);
    } finally {
        await mongoose.connection.close();
    }
}

verifySeats();
