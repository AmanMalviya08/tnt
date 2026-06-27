const jwt = require('jsonwebtoken');
const { userModel } = require('../models/userModel');

// ["Admin", "Agent", "Traveler", "Guest"]
const routePermissions = [
    //agents
    { path: '/api/agents/', method: 'POST', roles: ['Admin', 'SubAdmin', 'Agent', 'Distributor'], exact: true },
    { path: '/api/agents/', method: 'GET', roles: ['Admin', 'SubAdmin', 'Distributor'], exact: true },
    { path: '/api/agents/:id', method: 'PATCH', roles: ['Admin', 'SubAdmin', 'Distributor'] },
    { path: '/api/agents/:id', method: 'GET', roles: ['Admin', 'SubAdmin', 'Traveler', "Agent", "Guest", "Distributor"] },
    { path: '/api/agents/:id', method: 'PUT', roles: ['Admin', 'SubAdmin', 'Agent', 'Distributor'] },
    { path: '/api/agents/:id', method: 'DELETE', roles: ['Admin', 'SubAdmin', 'Distributor'] },

    //banner
    { path: '/api/banner/', method: 'POST', roles: ['Admin', 'SubAdmin'], exact: true },
    { path: '/api/banner/', method: 'GET', roles: ['Admin', 'SubAdmin', 'Traveler', "Agent", "Guest"], exact: true },
    { path: '/api/banner/:id', method: 'PUT', roles: ['Admin', 'SubAdmin'] },
    { path: '/api/banner/:id', method: 'DELETE', roles: ['Admin', 'SubAdmin'] },

    //blogs
    { path: '/api/blogs/', method: 'POST', roles: ['Admin', 'SubAdmin'], exact: true },
    { path: '/api/blogs/:id', method: 'PUT', roles: ['Admin', 'SubAdmin'] },
    { path: '/api/blogs/:id', method: 'DELETE', roles: ['Admin', 'SubAdmin'] },

    //cities
    { path: '/api/cities/', method: 'POST', roles: ['Admin', 'SubAdmin'], exact: true },
    { path: '/api/cities/:id', method: 'PUT', roles: ['Admin', 'SubAdmin'] },
    { path: '/api/cities/:id/disable', method: 'PATCH', roles: ['Admin', 'SubAdmin'] },
    { path: '/api/cities/:id', method: 'DELETE', roles: ['Admin', 'SubAdmin'] },

    //countries
    { path: '/api/countries/', method: 'POST', roles: ['Admin', 'SubAdmin'], exact: true },
    { path: '/api/countries/:id', method: 'PUT', roles: ['Admin', 'SubAdmin'] },
    { path: '/api/countries/:id/disable', method: 'PATCH', roles: ['Admin', 'SubAdmin'] },

    //contact us

    { path: '/api/contactUs/', method: 'POST', roles: ['Admin', 'SubAdmin', 'Traveler', "Agent"], exact: true },
    { path: '/api/contactUs/', method: 'GET', roles: ['Admin', 'SubAdmin'], exact: true },
    { path: '/api/contactUs/:id', method: 'GET', roles: ['Admin', 'SubAdmin', 'Traveler', "Agent"] },

    //faqs    
    { path: '/api/faq/', method: 'POST', roles: ['Admin', 'SubAdmin'], exact: true },
    { path: '/api/faq/:id', method: 'PUT', roles: ['Admin', 'SubAdmin'] },
    { path: '/api/faq/:id', method: 'DELETE', roles: ['Admin', 'SubAdmin'] },

    //benefits
    { path: '/api/benefits/', method: 'POST', roles: ['Admin', 'SubAdmin'], exact: true },
    { path: '/api/benefits/:id', method: 'PUT', roles: ['Admin', 'SubAdmin'] },
    { path: '/api/benefits/:id', method: 'DELETE', roles: ['Admin', 'SubAdmin'] },

    //guide allocations

    { path: '/api/guide-allocations/', method: 'POST', roles: ['Admin', 'SubAdmin'], exact: true },
    { path: '/api/guide-allocations/', method: 'GET', roles: ['Admin', 'SubAdmin'], exact: true },
    { path: '/api/guide-allocations/my-allocations', method: 'GET', roles: ['Admin', 'SubAdmin', 'Guide'], exact: true },
    { path: '/api/guide-allocations/my-history', method: 'GET', roles: ['Admin', 'SubAdmin', 'Guide'], exact: true },
    { path: '/api/guide-allocations/:id', method: 'GET', roles: ['Admin', 'SubAdmin', "Agent","Guide"] },
    { path: '/api/guide-allocations/:id', method: 'PUT', roles: ['Admin', 'SubAdmin'] },
    { path: '/api/guide-allocations/:id', method: 'DELETE', roles: ['Admin', 'SubAdmin'] },
    { path: '/api/guide-allocations/:id/transfer', method: 'POST', roles: ['Admin', 'SubAdmin'] },
    { path: '/api/guide-allocations/:id/status', method: 'PATCH', roles: ['Admin', 'SubAdmin', 'Guide'] },
    { path: '/api/guide-allocations/:id/itinerary/:dayNumber', method: 'PATCH', roles: ['Admin', 'SubAdmin', 'Guide'] },

    // guide tour logs
    { path: '/api/guide/tour-logs/my-logs', method: 'GET', roles: ['Guide'], exact: true },
    { path: '/api/guide/tour-logs', method: 'POST', roles: ['Guide'], exact: true },
    { path: '/api/guide/tour-logs/:id', method: 'DELETE', roles: ['Guide'] },

    //complaints
    { path: '/api/complaints/', method: 'POST', roles: ['Admin', 'SubAdmin', 'Traveler', 'Agent', 'Guide'], exact: true },
    { path: '/api/complaints/my-complaints', method: 'GET', roles: ['Admin', 'SubAdmin', 'Traveler', 'Agent', 'Guide'], exact: true },
    { path: '/api/complaints/', method: 'GET', roles: ['Admin', 'SubAdmin'], exact: true },
    { path: '/api/complaints/:id', method: 'GET', roles: ['Admin', 'SubAdmin', 'Traveler', 'Agent', 'Guide'] },
    { path: '/api/complaints/:id/status', method: 'PATCH', roles: ['Admin', 'SubAdmin'] },
    { path: '/api/complaints/:id', method: 'DELETE', roles: ['Admin', 'SubAdmin'] },

    //guide wallet
    { path: '/api/guide-wallet/my-wallet', method: 'GET', roles: ['Guide'], exact: true },
    { path: '/api/guide-wallet/my-transactions', method: 'GET', roles: ['Guide'], exact: true },
    { path: '/api/guide-wallet/my-withdrawals', method: 'GET', roles: ['Guide'], exact: true },
    { path: '/api/guide-wallet/withdraw', method: 'POST', roles: ['Guide'], exact: true },
    { path: '/api/guide-wallet/withdrawals', method: 'GET', roles: ['Admin', 'SubAdmin'], exact: true },
    { path: '/api/guide-wallet/withdrawals/approve/:id', method: 'PUT', roles: ['Admin', 'SubAdmin'] },
    { path: '/api/guide-wallet/withdrawals/reject/:id', method: 'PUT', roles: ['Admin', 'SubAdmin'] },

    //packages

    { path: '/api/packages/', method: 'POST', roles: ['Admin', 'SubAdmin'], exact: true },
    { path: '/api/packages/:id/duplicate', method: 'POST', roles: ['Admin', 'SubAdmin'] },
    { path: '/api/packages/:id/feature', method: 'PATCH', roles: ['Admin', 'SubAdmin'] },
    { path: '/api/packages/:id/disable', method: 'PATCH', roles: ['Admin', 'SubAdmin'] },
    { path: '/api/packages/:id', method: 'DELETE', roles: ['Admin', 'SubAdmin'] },
    { path: '/api/packages/:id', method: 'PUT', roles: ['Admin', 'SubAdmin'] },


    //place

    { path: '/api/places/', method: 'POST', roles: ['Admin', 'SubAdmin'], exact: true },
    { path: '/api/places/:id', method: 'PUT', roles: ['Admin', 'SubAdmin'] },
    { path: '/api/places/:id/disable', method: 'PATCH', roles: ['Admin', 'SubAdmin'] },
    { path: '/api/places/:id', method: 'DELETE', roles: ['Admin', 'SubAdmin'] },

    // review
    { path: '/api/review/', method: 'POST', roles: ['Admin', 'SubAdmin', 'Agent', 'Traveler'], exact: true },
    { path: '/api/review/:userId/:placeId', method: 'DELETE', roles: ['Admin', 'SubAdmin', 'Agent', 'Traveler'] },

    //state
    { path: '/api/states/', method: 'POST', roles: ['Admin', 'SubAdmin'], exact: true },
    { path: '/api/states/:id', method: 'PUT', roles: ['Admin', 'SubAdmin'] },
    { path: '/api/states/:id/disable', method: 'PATCH', roles: ['Admin', 'SubAdmin'] },
    //tour
    { path: '/api/tours/', method: 'POST', roles: ['Admin', 'SubAdmin'], exact: true },
    { path: '/api/tours/:id', method: 'PUT', roles: ['Admin', 'SubAdmin'] },
    { path: '/api/tours/toggle/:id', method: 'PATCH', roles: ['Admin', 'SubAdmin'] },
    { path: '/api/tours/:id/status', method: 'PATCH', roles: ['Admin', 'SubAdmin'] },
    { path: '/api/tours/:id/', method: 'DELETE', roles: ['Admin', 'SubAdmin'] },

    //users

    { path: '/api/users/', method: 'GET', roles: ['Admin', 'SubAdmin'], exact: true },
    { path: '/api/users/', method: 'POST', roles: ['Admin', 'SubAdmin', 'Traveler', 'Agent'], exact: true },
    { path: '/api/users/:id', method: 'PUT', roles: ['Admin', 'SubAdmin', 'Traveler', 'Agent', 'Distributor'] },
    { path: '/api/users/:id/disable', method: 'PATCH', roles: ['Admin', 'SubAdmin'] },

    //wishlist routes
    { path: '/api/wishlist/', method: 'POST', roles: ['Admin', 'SubAdmin', 'Traveler', 'Agent'], exact: true },
    { path: '/api/wishlist/:id', method: 'GET', roles: ['Admin', 'SubAdmin', 'Traveler', 'Agent'] },

    //bookings

    { path: '/api/bookings/', method: 'POST', roles: ['Admin', 'SubAdmin', 'Agent'], exact: true },
    { path: '/api/bookings/', method: 'GET', roles: ['Admin', 'SubAdmin', 'Agent'], exact: true },
    { path: '/api/bookings/user', method: 'GET', roles: ['Admin', 'SubAdmin', 'Traveler', 'Agent'], exact: true },
    { path: '/api/bookings/:id', method: 'PUT', roles: ['Admin', 'SubAdmin', 'Agent', 'Traveler'] },
    { path: '/api/bookings/:id/test-payment', method: 'POST', roles: ['Admin', 'SubAdmin', 'Agent'] },
    { path: '/api/bookings/:id', method: 'DELETE', roles: ['Admin', 'SubAdmin'] },
    { path: '/api/bookings/:id/disable', method: 'PATCH', roles: ['Admin', 'SubAdmin'] },

    //invoice

    { path: '/api/invoices/generate/:bookingId', method: 'POST', roles: ['Admin', 'SubAdmin', 'Agent'] },
    { path: '/api/invoices/regenerate/:bookingId', method: 'PUT', roles: ['Admin', 'SubAdmin', 'Agent'] },
    { path: '/api/invoices/send-whatsapp/:bookingId', method: 'POST', roles: ['Admin', 'SubAdmin', 'Agent'] },

    //admin analytics
    { path: '/api/admin/analytics', method: 'GET', roles: ['Admin', 'SubAdmin'], exact: true },

    //distributor
    { path: '/api/distributor/dashboard', method: 'GET', roles: ['Distributor', 'Admin', 'SubAdmin'], exact: true },

    //wallet
    { path: '/api/wallet/my-wallet', method: 'GET', roles: ['Agent', 'Admin', 'SubAdmin'], exact: true },
    { path: '/api/wallet/my-withdrawals', method: 'GET', roles: ['Agent', 'Admin', 'SubAdmin'], exact: true },
    { path: '/api/wallet/withdraw', method: 'POST', roles: ['Agent'], exact: true },
    { path: '/api/wallet/withdrawals', method: 'GET', roles: ['Admin', 'SubAdmin'], exact: true },
    { path: '/api/wallet/withdrawals/approve/:id', method: 'PUT', roles: ['Admin', 'SubAdmin'] },
    { path: '/api/wallet/withdrawals/reject/:id', method: 'PUT', roles: ['Admin', 'SubAdmin'] },
    { path: '/api/wallet/distributor/my-wallet', method: 'GET', roles: ['Distributor', 'Admin', 'SubAdmin'], exact: true },
    { path: '/api/wallet/distributor/my-withdrawals', method: 'GET', roles: ['Distributor', 'Admin', 'SubAdmin'], exact: true },
    { path: '/api/wallet/distributor/withdraw', method: 'POST', roles: ['Distributor'], exact: true },
    { path: '/api/wallet/distributor/transfer', method: 'POST', roles: ['Agent'], exact: true },
    { path: '/api/wallet/distributor/transfers/agent', method: 'GET', roles: ['Agent'], exact: true },
    { path: '/api/wallet/distributor/transfers/requests', method: 'GET', roles: ['Distributor'], exact: true },
    { path: '/api/wallet/distributor/transfers/approve/:id', method: 'PUT', roles: ['Distributor'] },
    { path: '/api/wallet/distributor/transfers/reject/:id', method: 'PUT', roles: ['Distributor'] },

    //rewards
    { path: '/api/rewards/status', method: 'GET', roles: ['Agent'], exact: true },
    { path: '/api/rewards/claim', method: 'POST', roles: ['Agent'], exact: true },
    { path: '/api/rewards/history', method: 'GET', roles: ['Agent'], exact: true },
    { path: '/api/rewards/', method: 'GET', roles: ['Admin', 'SubAdmin'], exact: true },

    // yatra loyalty (travelers)
    { path: '/api/yatra-loyalty/status', method: 'GET', roles: ['Traveler', 'Admin', 'SubAdmin'], exact: true },
    { path: '/api/yatra-loyalty/check-discount', method: 'GET', roles: ['Traveler', 'Admin', 'SubAdmin'], exact: true },
    { path: '/api/yatra-loyalty/history', method: 'GET', roles: ['Traveler', 'Admin', 'SubAdmin'], exact: true },
    { path: '/api/yatra-loyalty/', method: 'GET', roles: ['Admin', 'SubAdmin'], exact: true },

    // aadhaar, pricing, partial payment, locale
    { path: '/api/aadhaar/verify', method: 'POST', roles: ['Traveler', 'Agent', 'Admin', 'SubAdmin', 'Guide'], exact: true },
    { path: '/api/pricing/calculate', method: 'POST', roles: ['Traveler', 'Agent', 'Admin', 'SubAdmin'], exact: true },
    { path: '/api/pricing/rules', method: 'GET', roles: ['Admin', 'SubAdmin'], exact: true },
    { path: '/api/pricing/rules', method: 'POST', roles: ['Admin', 'SubAdmin'], exact: true },
    { path: '/api/pricing/rules/:id', method: 'PUT', roles: ['Admin', 'SubAdmin'] },
    { path: '/api/pricing/rules/:id', method: 'DELETE', roles: ['Admin', 'SubAdmin'] },
    { path: '/api/pricing/audit-logs', method: 'GET', roles: ['Admin', 'SubAdmin'], exact: true },
    { path: '/api/partial-payment/history', method: 'GET', roles: ['Traveler', 'Admin', 'SubAdmin'], exact: true },
    { path: '/api/partial-payment/summary/:bookingId', method: 'GET', roles: ['Traveler', 'Admin', 'SubAdmin'] },
    { path: '/api/partial-payment/balance/:bookingId', method: 'POST', roles: ['Traveler', 'Admin', 'SubAdmin'] },
    { path: '/api/partial-payment/balance/verify', method: 'POST', roles: ['Traveler', 'Admin', 'SubAdmin'], exact: true },
    { path: '/api/locale/language', method: 'GET', roles: ['Traveler', 'Agent', 'Admin', 'SubAdmin', 'Guide'], exact: true },
    { path: '/api/locale/language', method: 'PUT', roles: ['Traveler', 'Agent', 'Admin', 'SubAdmin', 'Guide'], exact: true },

    // user preferences (theme)
    { path: '/api/user/preferences', method: 'GET', roles: ['Traveler', 'Agent', 'Admin', 'SubAdmin', 'Guide'], exact: true },
    { path: '/api/user/preferences', method: 'PATCH', roles: ['Traveler', 'Agent', 'Admin', 'SubAdmin', 'Guide'], exact: true },

    { path: '/api/user/saved-travellers/combined', method: 'GET', roles: ['Traveler'], exact: true },
    { path: '/api/user/saved-travellers/from-bookings', method: 'GET', roles: ['Traveler'], exact: true },
    { path: '/api/user/saved-travellers', method: 'GET', roles: ['Traveler'], exact: true },
    { path: '/api/user/saved-travellers', method: 'POST', roles: ['Traveler'], exact: true },
    { path: '/api/user/saved-travellers/:id', method: 'PUT', roles: ['Traveler'] },
    { path: '/api/user/saved-travellers/:id', method: 'DELETE', roles: ['Traveler'] },

    // tour live status
    { path: '/api/guide/tours/:tourId/location', method: 'POST', roles: ['Admin', 'SubAdmin', 'Guide'] },
    { path: '/api/tour-status/update', method: 'POST', roles: ['Admin', 'SubAdmin', 'Guide'], exact: true },
    { path: '/api/tour-status/update/:tourId', method: 'POST', roles: ['Admin', 'SubAdmin', 'Guide'] },
    { path: '/api/tour-status/:tourId/my-status', method: 'GET', roles: ['Traveler', 'Agent', 'Admin', 'SubAdmin', 'Guide'] },
    { path: '/api/tour-status/:tourId', method: 'GET', roles: ['Traveler', 'Agent', 'Admin', 'SubAdmin', 'Guide'] },
    { path: '/api/admin/tours/:tourId/status-board', method: 'GET', roles: ['Admin', 'SubAdmin'] },

    // scratch coupons
    { path: '/api/coupons/mine', method: 'GET', roles: ['Traveler', 'Agent', 'Admin', 'SubAdmin'], exact: true },
    { path: '/api/coupons/:id/scratch', method: 'POST', roles: ['Traveler', 'Agent', 'Admin', 'SubAdmin'] },
    { path: '/api/coupons/:id/redeem', method: 'POST', roles: ['Traveler', 'Agent', 'Admin', 'SubAdmin'] },
    { path: '/api/admin/coupons', method: 'GET', roles: ['Admin', 'SubAdmin'], exact: true },
    { path: '/api/admin/coupons/:id/redeem', method: 'PATCH', roles: ['Admin', 'SubAdmin'] },

    // trip photo UGC
    { path: '/api/trip-photos/upload', method: 'POST', roles: ['Traveler', 'Agent', 'Admin', 'SubAdmin'], exact: true },
    { path: '/api/trip-photos/tour/:tourId/mine', method: 'GET', roles: ['Traveler', 'Agent', 'Admin', 'SubAdmin'] },
    { path: '/api/trip-photos/tour/:tourId', method: 'GET', roles: ['Traveler', 'Agent', 'Admin', 'SubAdmin', 'Guest'] },
    { path: '/api/trip-photos/photo/:photoId/like', method: 'POST', roles: ['Traveler', 'Agent', 'Admin', 'SubAdmin'] },
    { path: '/api/trip-photos/photo/:photoId', method: 'DELETE', roles: ['Traveler', 'Agent', 'Admin', 'SubAdmin'] },
    { path: '/api/trip-photos/photo/:photoId/share-link', method: 'GET', roles: ['Traveler', 'Agent', 'Admin', 'SubAdmin', 'Guest'] },
    { path: '/api/admin/gallery/pending', method: 'GET', roles: ['Admin', 'SubAdmin'], exact: true },
    { path: '/api/admin/gallery/bulk-approve', method: 'PATCH', roles: ['Admin', 'SubAdmin'], exact: true },
    { path: '/api/admin/gallery/:id/approve', method: 'PATCH', roles: ['Admin', 'SubAdmin'] },
    { path: '/api/admin/gallery/:id', method: 'DELETE', roles: ['Admin', 'SubAdmin'] },

    { path: '/api/about/', method: 'PUT', roles: ['Admin', 'SubAdmin'], exact: true },

    // leads (company agents only — enforced further by agentTypeMiddleware)
    { path: '/api/leads/', method: 'GET', roles: ['Agent', 'Admin', 'SubAdmin'], exact: true },
    { path: '/api/leads/', method: 'POST', roles: ['Agent', 'Admin', 'SubAdmin'], exact: true },
    { path: '/api/leads/meta/enums', method: 'GET', roles: ['Agent', 'Admin', 'SubAdmin'], exact: true },
    { path: '/api/leads/:id', method: 'GET', roles: ['Agent', 'Admin', 'SubAdmin'] },
    { path: '/api/leads/:id', method: 'PUT', roles: ['Agent', 'Admin', 'SubAdmin'] },
    { path: '/api/leads/export-leads/excel', method: 'GET', roles: ['Admin', 'SubAdmin'], exact: true },
    { path: '/api/leads/:id', method: 'DELETE', roles: ['Admin', 'SubAdmin'] },

    // guide tour operations
    { path: '/api/guide-ops/attendance/:allocationId', method: 'POST', roles: ['Guide', 'Admin', 'SubAdmin'] },
    { path: '/api/guide-ops/attendance/:allocationId', method: 'GET', roles: ['Guide', 'Admin', 'SubAdmin'] },
    { path: '/api/guide-ops/broadcast', method: 'POST', roles: ['Guide', 'Admin', 'SubAdmin'], exact: true },
    { path: '/api/guide-ops/broadcast/:tourId', method: 'GET', roles: ['Guide', 'Admin', 'SubAdmin'] },
    { path: '/api/guide-ops/expenses', method: 'POST', roles: ['Guide'], exact: true },
    { path: '/api/guide-ops/expenses/my', method: 'GET', roles: ['Guide'], exact: true },
    { path: '/api/guide-ops/expenses/pending', method: 'GET', roles: ['Admin', 'SubAdmin'], exact: true },
    { path: '/api/guide-ops/expenses/:id/review', method: 'PATCH', roles: ['Admin', 'SubAdmin'] },
    { path: '/api/guide-ops/expenses/export/csv', method: 'GET', roles: ['Guide'], exact: true },
    { path: '/api/guide-ops/missing-alert', method: 'POST', roles: ['Guide'], exact: true },
    { path: '/api/guide-ops/temple-checkin', method: 'POST', roles: ['Guide'], exact: true },
    { path: '/api/guide-ops/home-alerts', method: 'GET', roles: ['Agent'], exact: true },
    { path: '/api/guide-ops/certificate', method: 'GET', roles: ['Agent'], exact: true },
    { path: '/api/guide-ops/transactions/export', method: 'GET', roles: ['Agent'], exact: true },
    { path: '/api/admin/analytics/export', method: 'GET', roles: ['Admin', 'SubAdmin'], exact: true },
    { path: '/api/admin/commission-report', method: 'GET', roles: ['Admin', 'SubAdmin'], exact: true },

]




function matchPath(completePath, routePath, exact = false) {
    if (exact) {
        return completePath === routePath;
    }

    const pattern = routePath
        .replace(/\//g, '\\/')
        .replace(/:\w+/g, '[^/]+');

    // console.log("Pattern:", pattern);
    const regex = new RegExp(`^${pattern}$`);
    return regex.test(completePath);
}

exports.protect = async (req, res, next) => {
    try {

        const method = req.method;
        const currentPath = req.baseUrl + req.path;
        const token = req.headers.authorization?.split(" ")[1];
        console.log(token)
        if (!token) {

            return res.status(401).json({ success: false, message: "Not authorized, token missing" });
        }
        console.log(token)
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log(decoded)
        const user = await userModel.findById(decoded.userId)
            .select('-password -__v')
            .lean();
        console.log(user)
        // if (user.role == 'Agent' ) {
        //     return res.status(403).json({
        //         success: false,
        //         message: `Access denied. agent is not verified`
        //     });

        // }


        req.user = {
            userId: decoded.userId,
            role: user.role,

        }
        // console.log(req.user)

        // const matchedUrl = routePermissions.find(route => currentPath.startsWith(route.path) && route.method === method);
        const matchedRoute = routePermissions.find(route => {
            return matchPath(currentPath, route.path, route.exact) && route.method === method;
        });
        const isAgentCreationRoute = currentPath === '/api/agents/' && method === 'POST';

        if (user.role === 'Agent' && !isAgentCreationRoute && user.isVerified === false) {
            return res.status(403).json({
                success: false,
                message: `Access denied. Agent is not verified`
            });
        }


        // if (matchedUrl) {
        //     if (!matchedUrl.roles.includes(user.role)) {
        //         return res.status(403).json({success:false, message: "Forbidden: You don't have permission to access this resource",status:403 });
        //     }

        // }
        if (matchedRoute) {
            // console.log("Matched Route:", matchedRoute.path);
            if (!matchedRoute.roles.includes(req.user.role)) {
                return res.status(403).json({
                    success: false,

                    message: `Access denied. Required role: ${matchedRoute.roles.join(' or ')}`
                });
            }
        }




        next();
    } catch (err) {
        return res.status(401).json({ message: "Not authorized, invalid token" });
    }
};
