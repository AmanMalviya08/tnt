const { default: mongoose } = require("mongoose");
const Guide = require("../models/guideModel");
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
            registrationNumber
        } = payload;

        const existingGuide = await this.model.findOne({
            $or: [{ email }, { licenseNumber }]
        });

        if (existingGuide) {
            throw new Error('Guide with this email or license number already exists');
        }

        const newGuide = await this.model.create({
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
            createdBy
        });

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
            const status = filters.status.trim().toLowerCase();
            if (validStatuses.includes(status)) {
                normalizedFilter.status = status;
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
                ...(status === 'active' && { isVerified: true, verificationDate: new Date() })
            },
            { new: true, runValidators: true }
        );

        if (!guide) {
            throw new Error('Guide not found');
        }

        return guide;
    }



    async addComplaint(payload) {
        const { guideId, userId, tourId,type='Other', subject, description, severity = 'Medium' } = payload;
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
}
module.exports = GuideController;