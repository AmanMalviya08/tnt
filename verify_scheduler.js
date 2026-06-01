const mongoose = require('mongoose');
const { tourModel } = require('./src/models/tourModel');
const { checkAndDisableExpiredTours } = require('./src/services/tourScheduler');

// Connect to MongoDB (modify connection string as needed, assuming strict env setup or default local)
// Since I don't have the exact .env, I will assume a standard local connection or try to read from where server connects.
// However, the best way is to use the existing db connection logic if possible, but for a standalone script, I'll try to duplicate the minimal connection logic or piggyback on a running server if I could, but standalone is safer for testing.

// Let's rely on the user running the server effectively having the DB connection. 
// BUT, this script needs its own connection. 
// I'll try to read .env first or assume localhost if not available.

require('dotenv').config();

const runVerification = async () => {
    try {
        const mongoUri = process.env.MONGO_URI || process.env.DB_URL || 'mongodb://localhost:27017/tour-travels'; // Fallback
        console.log('Connecting to MongoDB...');
        await mongoose.connect(mongoUri);
        console.log('Connected.');

        // 1. Create a "Past Tour"
        console.log('Creating a test expired tour...');
        const pastDate = new Date();
        pastDate.setDate(pastDate.getDate() - 2); // 2 days ago

        // We need a city ID - just pick one or create a dummy object ID
        // Ideally we fetch one to be safe on required fields.
        // For simplicity, let's try to fetch an existing city or just skip validation if possible (not possible with mongoose usually).
        // Let's create a minimal tour object. checking required fields in model...
        // tourName, cityId, startDate, endDate are required.

        // Fetch a city first
        const City = mongoose.model('City', new mongoose.Schema({})); // minimal schema just to find
        const city = await mongoose.connection.collection('cities').findOne({});
        let cityId = city ? city._id : new mongoose.Types.ObjectId();

        const tour = new tourModel({
            tourName: 'Test Expired Tour ' + Date.now(),
            cityId: cityId,
            startDate: new Date(pastDate.getTime() - 86400000),
            endDate: pastDate,
            isDisabled: false, // Explicitly active
            status: 'Upcoming' // Incorrect status for a past date, to see if it gets fixed
        });

        // We bypass the pre-save hook for status check initially? 
        // Wait, the pre-save hook I modified runs `ensureStatus` which sets isDisabled.
        // So simply saving it *should* already disable it if my model logic works!
        // That verifies Part 1 (Model Logic).

        await tour.save();
        console.log(`Tour created with ID: ${tour._id}`);

        let savedTour = await tourModel.findById(tour._id);
        console.log('Immediate check after save:');
        console.log(`- Status: ${savedTour.status}`);
        console.log(`- isDisabled: ${savedTour.isDisabled}`);

        if (savedTour.isDisabled === true && savedTour.status === 'Completed') {
            console.log('SUCCESS: Model pre-save hook correctly disabled the expired tour.');
        } else {
            console.log('FAILURE: Model pre-save hook did NOT disable the tour.');
        }

        // 2. Test Scheduler Logic
        // Let's manually force one to be enabled and see if scheduler catches it.
        console.log('\nTesting Scheduler Logic...');
        await tourModel.updateOne({ _id: tour._id }, { $set: { isDisabled: false, status: 'Ongoing' } }); // Force it back to active/wrong

        // Verify it is "broken"
        let brokeTour = await tourModel.findById(tour._id);
        console.log(`Forced tour to enable. isDisabled: ${brokeTour.isDisabled}, Status: ${brokeTour.status}`);

        // Run scheduler function
        console.log('Running checkAndDisableExpiredTours()...');
        await checkAndDisableExpiredTours();

        // Re-fetch
        let fixedTour = await tourModel.findById(tour._id);
        console.log('Check after scheduler run:');
        console.log(`- Status: ${fixedTour.status}`);
        console.log(`- isDisabled: ${fixedTour.isDisabled}`);

        if (fixedTour.isDisabled === true && fixedTour.status === 'Completed') {
            console.log('SUCCESS: Scheduler correctly disabled the expired tour.');
        } else {
            console.log('FAILURE: Scheduler did NOT disable the tour.');
        }

        // Cleanup
        console.log('\nCleaning up...');
        await tourModel.deleteOne({ _id: tour._id });
        console.log('Test tour deleted.');

    } catch (err) {
        console.error('Verification failed with error:', err);
    } finally {
        await mongoose.disconnect();
    }
};

runVerification();
