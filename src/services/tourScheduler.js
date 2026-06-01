const cron = require('node-cron');
const { tourModel } = require('../models/tourModel');

const checkAndDisableExpiredTours = async () => {
    try {
        const now = new Date();
        // Find tours that are expired (endDate < now) but are not yet disabled
        const result = await tourModel.updateMany(
            {
                endDate: { $lt: now },
                isDisabled: { $ne: true }
            },
            {
                $set: {
                    isDisabled: true,
                    status: 'Completed'
                }
            }
        );

        if (result.modifiedCount > 0) {
            console.log(`[Tour Scheduler] Disabled ${result.modifiedCount} expired tours.`);
        }
    } catch (error) {
        console.error('[Tour Scheduler] Error checking expired tours:', error);
    }
};

const initTourScheduler = () => {
    cron.schedule('0 0 * * *', () => {
        checkAndDisableExpiredTours();
    });

    checkAndDisableExpiredTours();

    console.log('[Tour Scheduler] Initialized tour expiration checker');
};

module.exports = {
    initTourScheduler,
    checkAndDisableExpiredTours // Exported for potential manual invocation or testing
};
