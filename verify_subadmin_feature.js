const http = require('http');

const BASE_URL = 'http://localhost:14000/api/users';

function request(url, method, body = null, headers = {}) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port,
            path: urlObj.pathname + urlObj.search,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                ...headers
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve({ status: res.statusCode, data: parsed });
                } catch (e) {
                    console.error("Failed to parse JSON:", data);
                    resolve({ status: res.statusCode, data: null, raw: data });
                }
            });
        });

        req.on('error', (e) => {
            reject(e);
        });

        if (body) {
            req.write(JSON.stringify(body));
        }
        req.end();
    });
}

async function runVerification() {
    console.log("Starting SubAdmin Feature Verification (Native HTTP)...");

    const timestamp = Date.now();
    const adminEmail = `admin_test_${timestamp}@example.com`;
    const adminPassword = 'password123';

    // 1. Register Admin
    console.log(`\n1. Registering Test Admin (${adminEmail})...`);
    let result = await request(`${BASE_URL}/register`, 'POST', { email: adminEmail, password: adminPassword });

    if (!result.data || !result.data.success) {
        console.error("Failed to register admin:", result.data);
        return;
    }
    console.log("Admin registered successfully.");

    // 2. Login Admin
    console.log(`\n2. Logging in as Admin...`);
    result = await request(`${BASE_URL}/login`, 'POST', { email: adminEmail, password: adminPassword });

    if (!result.data || !result.data.success) {
        console.error("Failed to login admin:", result.data);
        return;
    }
    const adminToken = result.data.data.token;
    console.log("Admin logged in successfully. Token received.");

    // 3. Create SubAdmin
    const subAdminEmail = `subadmin_test_${timestamp}@example.com`;
    const subAdminPassword = 'password123';
    console.log(`\n3. Creating SubAdmin (${subAdminEmail})...`);

    result = await request(`${BASE_URL}/sub-admin`, 'POST', {
        email: subAdminEmail,
        password: subAdminPassword,
        firstName: "Sub",
        lastName: "Admin",
        permissions: ["manage_users", "view_reports"]
    }, {
        'Authorization': `Bearer ${adminToken}`
    });

    if (!result.data || !result.data.success) {
        console.error("Failed to create subadmin:", result.data);
        return;
    }
    const subAdminId = result.data.data.userId;
    console.log("SubAdmin created successfully. ID:", subAdminId);

    // 4. Get All SubAdmins
    console.log(`\n4. Fetching All SubAdmins...`);
    result = await request(`${BASE_URL}/sub-admin`, 'GET', null, {
        'Authorization': `Bearer ${adminToken}`
    });

    if (!result.data || !result.data.success) {
        console.error("Failed to fetch subadmins:", result.data);
        return;
    }
    console.log(`Fetched ${result.data.data.length} subadmins.`);
    const foundSubAdmin = result.data.data.find(u => u._id === subAdminId);
    if (foundSubAdmin) {
        console.log("✓ Verification Passed: Created SubAdmin found in the list.");
        console.log("Permissions:", foundSubAdmin.permissions);
    } else {
        console.error("❌ Verification Failed: Created SubAdmin NOT found in the list.");
    }

    // 5. Toggle SubAdmin Status (Disable)
    console.log(`\n5. Disabling SubAdmin...`);
    result = await request(`${BASE_URL}/sub-admin/${subAdminId}/toggle-status`, 'PATCH', null, {
        'Authorization': `Bearer ${adminToken}`
    });

    if (!result.data || !result.data.success) {
        console.error("Failed to toggle status:", result.data);
        return;
    }
    console.log("Status toggled. Validation message:", result.data.message);
    if (result.data.data.isDisabled) {
        console.log("✓ Verification Passed: SubAdmin is now disabled.");
    } else {
        console.error("❌ Verification Failed: SubAdmin should be disabled.");
    }

    // 6. Try Login as Disabled SubAdmin (Should fail?)
    console.log(`\n6. Attempting login as Disabled SubAdmin (Expect Failure)...`);
    result = await request(`${BASE_URL}/login`, 'POST', { email: subAdminEmail, password: subAdminPassword });

    if (result.data && result.data.success) {
        console.error("❌ Verification Failed: Disabled SubAdmin WAS able to login.");
    } else {
        console.log("✓ Verification Passed: Disabled SubAdmin could not login. Message:", result.data ? result.data.message : "Request failed as expected");
    }

    // 7. Toggle SubAdmin Status (Enable)
    console.log(`\n7. Enabling SubAdmin...`);
    result = await request(`${BASE_URL}/sub-admin/${subAdminId}/toggle-status`, 'PATCH', null, {
        'Authorization': `Bearer ${adminToken}`
    });

    if (!result.data || !result.data.success) {
        console.error("Failed to toggle status:", result.data);
        return;
    }
    console.log("Status toggled. Validation message:", result.data.message);
    if (!result.data.data.isDisabled) {
        console.log("✓ Verification Passed: SubAdmin is now enabled.");
    } else {
        console.error("❌ Verification Failed: SubAdmin should be enabled.");
    }

    // 8. Try Login as Enabled SubAdmin (Should success)
    console.log(`\n8. Attempting login as Enabled SubAdmin (Expect Success)...`);
    result = await request(`${BASE_URL}/login`, 'POST', { email: subAdminEmail, password: subAdminPassword });

    if (result.data && result.data.success) {
        console.log("✓ Verification Passed: Enabled SubAdmin logged in successfully.");
        const subAdminToken = result.data.data.token;

        // 9. Try to create another subadmin as SubAdmin (Should fail)
        console.log(`\n9. Attempting to create SubAdmin AS SubAdmin (Expect Failure - 403)...`);
        result = await request(`${BASE_URL}/sub-admin`, 'POST', {
            email: `fail_test_${timestamp}@example.com`,
            password: "password",
            firstName: "Fail",
            lastName: "Test"
        }, {
            'Authorization': `Bearer ${subAdminToken}`
        });

        if (result.status === 403) {
            console.log("✓ Verification Passed: SubAdmin correctly forbidden from creating SubAdmins.");
        } else {
            console.error(`❌ Verification Failed: Expected 403 but got ${result.status}. Response:`, result.data);
        }

    } else {
        console.error("❌ Verification Failed: Enabled SubAdmin could NOT login. Message:", result.data ? result.data.message : "Request failed");
    }

    console.log("\nVerification Complete.");
}

runVerification();
