const { default: mongoose } = require("mongoose");
const Guide = require("../models/guideModel");
const reviewModel = require("../models/reviewModel");
const { userModel } = require("../models/userModel");
const DEFAULT_PAGE_SIZE = parseInt(process.env.DEFAULT_PAGE_SIZE || "20", 10);

class GuideController {
    constructor(model = Guide) {
        this.model = model;
    }

    async registerGuide(payload) {
        const {
            fullName,
            email,
            phone,
            licenseNumber,
            languages,
            dob,
            nationality,
            preferredTourType,
            timeAvailability,
            upiId,
            paymentTerms,
            preferredLocations,
            availability,
            performance,
            specializations,
            experience,
            certification,
            bio,
            address,
            emergencyContact,
            bankDetails,
            ratePerHour,
            createdBy,
            status,
            idProof,
            gender,
            registrationNumber,
            documents
        } = payload;

        const existingGuide = await this.model.findOne({
            $or: [{ email }, { licenseNumber }]
        });

        if (existingGuide) {
            throw new Error('Guide with this email or license number already exists');
        }

        // Check if User exists
        let user = await userModel.findOne({
            $or: [{ email }, { phone }],
        });
        if (user && user.role != 'Guide') {
            throw new Error("Different type of user already exists with this email or phone");
        }

        if (!user) {
            // Create new User
            const randomPassword = Math.random().toString(36).slice(-8); // Random password
            const firstName = fullName ? fullName.split(' ')[0] : "Guide";
            const lastName = fullName && fullName.split(' ').length > 1 ? fullName.split(' ').slice(1).join(' ') : "User";
            user = await userModel.create({
                firstName: firstName,
                lastName: lastName,
                email: email,
                phone: phone,
                role: "Guide",
                password: randomPassword,
                status: "Active",
                isEmailVerified: true,
                isPhoneVerified: true
            });
        }

        // Build documents object from uploaded file URLs or body payload
        const now = new Date();
        const docFields = ['passportImage', 'guideLicenseImage', 'aidCertificateImage', 'proofOfAddressImage'];
        const docsPayload = {};
        for (const field of docFields) {
            const url = documents?.[field] || null;
            if (url) {
                docsPayload[field] = { url, status: 'Pending', remarks: null, uploadedAt: now };
            }
        }

        const newGuide = await this.model.create({
            userId: user._id,
            fullName,
            email,
            phone,
            licenseNumber,
            registrationNumber,
            idProof,
            languages,
            specializations,
            experience: experience || 0,
            certification,
            bio,
            address,
            emergencyContact,
            bankDetails,
            ratePerHour: ratePerHour || 0,
            dob,
            nationality,
            preferredTourType,
            timeAvailability,
            upiId,
            paymentTerms,
            preferredLocations,
            availability,
            performance,
            gender,
            status: status || 'Pending',
            createdBy,
            documents: docsPayload
        });

        if (newGuide && newGuide.userId) {
            const userUpdatePayload = {};
            if (fullName) {
                userUpdatePayload.firstName = fullName.split(' ')[0];
                userUpdatePayload.lastName = fullName.split(' ').slice(1).join(' ');
            }
            if (Object.keys(userUpdatePayload).length > 0) {
                await userModel.findByIdAndUpdate(newGuide.userId, userUpdatePayload, {
                    new: true,
                    runValidators: true,
                });
            }
        }

        return newGuide;
    }

    async getGuides(options = {}, filters = {}) {
        const normalizedFilter = {};
        if (filters.guideId && filters.guideId.trim()) {
            const value = filters.guideId.trim();
            if (mongoose.Types.ObjectId.isValid(value)) {
                normalizedFilter._id = new mongoose.Types.ObjectId(value);
            }
        }
        if (filters.status && filters.status.trim()) {
            const validStatuses = ['Active', 'Inactive', 'Suspended', 'Pending'];
            const inputStatus = filters.status.trim().toLowerCase();
            const matchedStatus = validStatuses.find(s => s.toLowerCase() === inputStatus);
            if (matchedStatus) {
                normalizedFilter.status = matchedStatus;
            }
        }

        if (filters.specialization && filters.specialization.trim()) {
            normalizedFilter.specializations = {
                $in: [filters.specialization.trim()]
            };
        }

        if (filters.language && filters.language.trim()) {
            normalizedFilter.languages = {
                $in: [filters.language.trim()]
            };
        }

        if (filters.isVerified !== undefined) {
            normalizedFilter.isVerified = filters.isVerified === 'true' || filters.isVerified === true;
        }
        if (filters.minRating && !isNaN(Number(filters.minRating))) {
            const rating = Math.min(Math.max(Number(filters.minRating), 0), 5);
            normalizedFilter['performance.averageRating'] = { $gte: rating };
        }

        if (filters.search && filters.search.trim()) {
            const searchRegex = new RegExp(filters.search.trim(), 'i');
            normalizedFilter.$or = [
                { fullName: searchRegex },
                { firstName: searchRegex },
                { lastName: searchRegex },
                { email: searchRegex }
            ];
        }

        const parsedPage = parseInt(options.page, 10);
        const parsedLimit = parseInt(options.limit, 10);

        const pageSize = !Number.isNaN(parsedLimit) && parsedLimit > 0 ? parsedLimit : DEFAULT_PAGE_SIZE;
        const currentPage = !Number.isNaN(parsedPage) && parsedPage > 0 ? parsedPage : 1;

        const sortBy = options.sortBy || 'createdAt';
        const sortOrder = options.sortOrder === 'asc' ? 1 : -1;

        const query = this.model
            .find(normalizedFilter)
            .sort({ [sortBy]: sortOrder })
            .skip((currentPage - 1) * pageSize)
            .limit(pageSize)
            .lean();

        const [items, totalItems] = await Promise.all([
            query.exec(),
            this.model.countDocuments(normalizedFilter)
        ]);

        const totalPages = Math.max(Math.ceil(totalItems / pageSize) || 1, 1);

        return {
            data: items,
            pagination: {
                totalItems,
                totalPages,
                pageSize,
                currentPage,
                hasNextPage: currentPage < totalPages,
                hasPrevPage: currentPage > 1
            }
        };
    }

    async getGuideById(guideId) {
        if (!mongoose.Types.ObjectId.isValid(guideId)) {
            throw new Error('Invalid guide ID');
        }

        const guide = await this.model
            .findById(guideId)
            .lean();

        if (!guide) {
            throw new Error('Guide not found');
        }

        return guide;
    }

    async updateGuide(guideId, updateData, updatedBy) {
        if (!mongoose.Types.ObjectId.isValid(guideId)) {
            throw new Error('Invalid guide ID');
        }

        // const allowedUpdates = [
        //     'fullName', 'phone', 'profileImage',
        //     'languages', 'specializations', 'experience',
        //     'certification', 'bio', 'address', 'emergencyContact',
        //     'availability', 'ratePerHour', 'status', 'isVerified',
        //     "preferredTourType","dob","licenseNumber","timeAvailability",
        //     "upiId","paymentTerms","preferredLocations"
        // ];

        // const updates = {};
        // Object.keys(updateData).forEach(key => {
        //     if (allowedUpdates.includes(key)) {
        //         updates[key] = updateData[key];
        //     }
        // });

        // updates.lastModifiedBy = updatedBy;
        updateData.lastModifiedBy = updatedBy

        const currentGuide = await this.model.findById(guideId);
        if (currentGuide && currentGuide.userId) {
            const userUpdatePayload = {};
            if (updateData.fullName !== undefined) {
                userUpdatePayload.firstName = updateData.fullName.split(' ')[0];
                userUpdatePayload.lastName = updateData.fullName.split(' ').slice(1).join(' ');
            }
            if (updateData.email !== undefined) {
                userUpdatePayload.email = updateData.email;
            }
            if (updateData.profileImage !== undefined) {
                userUpdatePayload.avatarUrl = updateData.profileImage;
            }
            if (Object.keys(userUpdatePayload).length > 0) {
                await userModel.findByIdAndUpdate(currentGuide.userId, userUpdatePayload, {
                    new: true,
                    runValidators: true,
                });
            }
        }

        const guide = await this.model.findByIdAndUpdate(
            guideId,
            { $set: updateData },
            { new: true, runValidators: true }
        );

        if (!guide) {
            throw new Error('Guide not found');
        }

        return guide;
    }

    async updateGuideStatus(guideId, status, updatedBy) {
        const validStatuses = ['Active', 'Inactive', 'Suspended', 'Pending'];

        if (!validStatuses.includes(status)) {
            throw new Error('Invalid status');
        }

        const guide = await this.model.findByIdAndUpdate(
            guideId,
            {
                status,
                lastModifiedBy: updatedBy,
                ...(status === 'Active' && { isVerified: true, verificationDate: new Date() })
            },
            { new: true, runValidators: true }
        );

        if (!guide) {
            throw new Error('Guide not found');
        }

        return guide;
    }



    async addComplaint(payload) {
        const { guideId, userId, tourId, type = 'Other', subject, description, severity = 'Medium' } = payload;
        if (!mongoose.Types.ObjectId.isValid(guideId)) {
            throw new Error('Invalid guide ID');
        }

        const guide = await this.model.findById(guideId);
        if (!guide) {
            throw new Error('Guide not found');
        }

        const complaintId = new mongoose.Types.ObjectId();

        console.log("inside complaint")
        guide.complaints.push({
            complaintId,
            userId,
            tourId,
            subject,
            description,
            severity,
            type,
            status: 'Pending'
        });

        await guide.save();

        return guide;
    }

    async getGuideComplaints(guideId, filters = {}, options = {}) {
        if (!mongoose.Types.ObjectId.isValid(guideId)) {
            throw new Error('Invalid guide ID');
        }

        const parsedPage = parseInt(options.page, 10);
        const parsedLimit = parseInt(options.limit, 10);
        const pageSize = !Number.isNaN(parsedLimit) && parsedLimit > 0 ? parsedLimit : 10;
        const currentPage = !Number.isNaN(parsedPage) && parsedPage > 0 ? parsedPage : 1;

        const pipeline = [
            { $match: { _id: new mongoose.Types.ObjectId(guideId) } },
            { $unwind: '$complaints' },
            ...(filters.status && filters.status.trim() ? [
                { $match: { 'complaints.status': filters.status.trim() } }
            ] : []),

            ...(filters.severity && filters.severity.trim() ? [
                { $match: { 'complaints.severity': filters.severity.trim() } }
            ] : []),

            {
                $lookup: {
                    from: 'users',
                    localField: 'complaints.userId',
                    foreignField: '_id',
                    as: 'complaints.userDetails'
                }
            },

            {
                $lookup: {
                    from: 'tours',
                    localField: 'complaints.tourId',
                    foreignField: '_id',
                    as: 'complaints.tourDetails'
                }
            },

            { $unwind: { path: '$complaints.userDetails', preserveNullAndEmptyArrays: true } },
            { $unwind: { path: '$complaints.tourDetails', preserveNullAndEmptyArrays: true } },

            {
                $project: {
                    complaint: '$complaints',
                    user: {
                        firstName: '$complaints.userDetails.firstName',
                        lastName: '$complaints.userDetails.lastName',
                        email: '$complaints.userDetails.email'
                    },
                    tour: {
                        tourName: '$complaints.tourDetails.tourName',
                        tourDate: '$complaints.tourDetails.tourDate'
                    }
                }
            },

            {
                $facet: {
                    metadata: [{ $count: 'totalItems' }],
                    data: [
                        { $skip: (currentPage - 1) * pageSize },
                        { $limit: pageSize }
                    ]
                }
            }
        ];

        const result = await this.model.aggregate(pipeline);

        const totalItems = result[0].metadata[0]?.totalItems || 0;
        const paginatedComplaints = result[0].data || [];
        const totalPages = Math.max(Math.ceil(totalItems / pageSize) || 1, 1);


        return {
            data: paginatedComplaints,
            pagination: {
                totalItems,
                totalPages,
                pageSize,
                currentPage,
                hasNextPage: currentPage < totalPages,
                hasPrevPage: currentPage > 1
            }
        };
    }

    async updateComplaintStatus(guideId, complaintId, status, resolution = null) {
        const validStatuses = ['Pending', 'Investigating', 'Resolved', 'Dismissed'];

        if (!validStatuses.includes(status)) {
            throw new Error('Invalid complaint status');
        }

        const guide = await this.model.findById(guideId);
        console.log(guide)
        if (!guide) {
            throw new Error('Guide not found');
        }

        const complaint = guide.complaints.id(new mongoose.Types.ObjectId(complaintId));
        console.log(complaintId)
        if (!complaint) {
            throw new Error('Complaint not found');
        }

        complaint.status = status;
        if (status === 'resolved' || status === 'dismissed') {
            complaint.resolvedAt = new Date();
            complaint.resolution = resolution;
        }

        await guide.save();

        return guide;
    }

    async deleteGuide(guideId) {
        if (!mongoose.Types.ObjectId.isValid(guideId)) {
            throw new Error('Invalid guide ID');
        }

        const guide = await this.model.findByIdAndDelete(guideId);


        return { message: 'Guide deleted successfully', guide };
    }

    /**
     * Admin verifies guide KYC documents.
     * Body example:
     * {
     *   "passportImage":       { "status": "Approved" },
     *   "guideLicenseImage":   { "status": "Rejected", "remarks": "Blurry image" },
     *   "aidCertificateImage": { "status": "Approved" },
     *   "proofOfAddressImage": { "status": "Approved" },
     *   "overallRemarks":      "License image needs re-upload"
     * }
     */
    async verifyGuideDocuments(guideId, verificationData, verifiedBy) {
        if (!mongoose.Types.ObjectId.isValid(guideId)) {
            throw new Error('Invalid guide ID');
        }

        const guide = await this.model.findById(guideId);
        if (!guide) {
            throw new Error('Guide not found');
        }

        const docFields = ['passportImage', 'guideLicenseImage', 'aidCertificateImage', 'proofOfAddressImage'];
        const validStatuses = ['Pending', 'Approved', 'Rejected'];

        // Update individual document statuses
        for (const field of docFields) {
            if (verificationData[field]) {
                const { status, remarks } = verificationData[field];
                if (status && !validStatuses.includes(status)) {
                    throw new Error(`Invalid status '${status}' for ${field}`);
                }
                if (!guide.documents) guide.documents = {};
                if (!guide.documents[field]) guide.documents[field] = {};

                if (status) guide.documents[field].status = status;
                if (remarks !== undefined) guide.documents[field].remarks = remarks;
            }
        }

        // Auto-compute overall verification status
        const statuses = docFields
            .map(f => guide.documents?.[f]?.status)
            .filter(Boolean);

        let overallStatus = 'Pending';
        if (statuses.length > 0) {
            const allApproved = statuses.every(s => s === 'Approved');
            const anyRejected = statuses.some(s => s === 'Rejected');

            if (allApproved) {
                overallStatus = 'Verified';
            } else if (anyRejected) {
                overallStatus = 'Rejected';
            } else {
                overallStatus = 'Partial';
            }
        }

        guide.documentVerification = {
            status: overallStatus,
            verifiedBy: verifiedBy,
            verifiedAt: new Date(),
            remarks: verificationData.overallRemarks || null
        };

        // If all documents approved, also mark guide status Active & set verification date
        if (overallStatus === 'Verified') {
            guide.status = 'Active';
            guide.verificationDate = new Date();
        }

        guide.markModified('documents');
        await guide.save();

        return guide;
    }

    /**
     * Get all reviews for a guide along with guide info (name, image, ratings).
     * Returns: { guide: { _id, fullName, profileImage, averageRating, totalReviews }, reviews, pagination }
     */
    async getGuideReviews(guideId, options = {}) {
        if (!mongoose.Types.ObjectId.isValid(guideId)) {
            throw new Error('Invalid guide ID');
        }

        // Fetch guide basic info
        const guide = await this.model.findById(guideId)
            .select('fullName profileImage ratings performance.averageRating performance.totalReviews')
            .lean();

        if (!guide) {
            throw new Error('Guide not found');
        }

        // Pagination
        const parsedPage = parseInt(options.page, 10);
        const parsedLimit = parseInt(options.limit, 10);
        const pageSize = !Number.isNaN(parsedLimit) && parsedLimit > 0 ? parsedLimit : DEFAULT_PAGE_SIZE;
        const currentPage = !Number.isNaN(parsedPage) && parsedPage > 0 ? parsedPage : 1;

        const sortOrder = options.sortOrder === 'asc' ? 1 : -1;

        const matchFilter = { guideId: new mongoose.Types.ObjectId(guideId) };

        // Optional rating filter
        if (options.rating && !isNaN(Number(options.rating))) {
            const rating = Math.min(Math.max(Number(options.rating), 1), 5);
            matchFilter.rating = { $gte: rating, $lt: rating + 1 };
        }

        const pipeline = [
            { $match: matchFilter },
            { $sort: { createdAt: sortOrder } },
            {
                $facet: {
                    metadata: [{ $count: 'totalItems' }],
                    data: [
                        { $skip: (currentPage - 1) * pageSize },
                        { $limit: pageSize },
                        {
                            $lookup: {
                                from: 'users',
                                localField: 'userId',
                                foreignField: '_id',
                                as: 'user'
                            }
                        },
                        { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
                        {
                            $lookup: {
                                from: 'tours',
                                localField: 'tourId',
                                foreignField: '_id',
                                as: 'tour'
                            }
                        },
                        { $unwind: { path: '$tour', preserveNullAndEmptyArrays: true } },
                        {
                            $lookup: {
                                from: 'bookings',
                                localField: 'bookingId',
                                foreignField: '_id',
                                as: 'booking'
                            }
                        },
                        { $unwind: { path: '$booking', preserveNullAndEmptyArrays: true } },
                        {
                            $project: {
                                _id: 1,
                                rating: 1,
                                review: 1,
                                createdAt: 1,
                                'user._id': 1,
                                'user.firstName': 1,
                                'user.lastName': 1,
                                'user.avatarUrl': 1,
                                'tour._id': 1,
                                'tour.tourName': 1,
                                'booking._id': 1,
                                'booking.bookingRef': 1
                            }
                        }
                    ]
                }
            }
        ];

        const result = await reviewModel.aggregate(pipeline);

        const totalItems = result[0].metadata[0]?.totalItems || 0;
        const reviews = result[0].data || [];
        const totalPages = Math.max(Math.ceil(totalItems / pageSize) || 1, 1);

        return {
            guide: {
                _id: guide._id,
                fullName: guide.fullName,
                profileImage: guide.profileImage,
                averageRating: guide.ratings?.averageRating || guide.performance?.averageRating || 0,
                totalReviews: guide.ratings?.totalReviews || guide.performance?.totalReviews || 0
            },
            reviews,
            pagination: {
                totalItems,
                totalPages,
                pageSize,
                currentPage,
                hasNextPage: currentPage < totalPages,
                hasPrevPage: currentPage > 1
            }
        };
    }
}
module.exports = GuideController;