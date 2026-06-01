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
    { path: '/api/guide-allocations/:id', method: 'GET', roles: ['Admin', 'SubAdmin', "Agent"] },
    { path: '/api/guide-allocations/:id', method: 'PUT', roles: ['Admin', 'SubAdmin'] },
    { path: '/api/guide-allocations/:id', method: 'DELETE', roles: ['Admin', 'SubAdmin'] },
    { path: '/api/guide-allocations/:id/transfer', method: 'POST', roles: ['Admin', 'SubAdmin'] },

    //packages

    { path: '/api/packages/', method: 'POST', roles: ['Admin', 'SubAdmin'], exact: true },
    { path: '/api/packages/:id/duplicate', method: 'POST', roles: ['Admin', 'SubAdmin'] },
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

    { path: '/api/bookings/', method: 'POST', roles: ['Admin', 'SubAdmin'], exact: true },
    { path: '/api/bookings/', method: 'GET', roles: ['Admin', 'SubAdmin'], exact: true },
    { path: '/api/bookings/user', method: 'GET', roles: ['Admin', 'SubAdmin', 'Traveler', 'Agent'], exact: true },
    { path: '/api/bookings/:id', method: 'PUT', roles: ['Admin', 'SubAdmin'] },
    { path: '/api/bookings/:id', method: 'DELETE', roles: ['Admin', 'SubAdmin'] },
    { path: '/api/bookings/:id/disable', method: 'PATCH', roles: ['Admin', 'SubAdmin'] },

    //invoice

    { path: '/api/invoices/generate/:bookingId', method: 'POST', roles: ['Admin', 'SubAdmin'] },
    { path: '/api/invoices/regenerate/:bookingId', method: 'PUT', roles: ['Admin', 'SubAdmin'] },

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
