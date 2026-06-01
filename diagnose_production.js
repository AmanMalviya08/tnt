require('dotenv').config();
const emailService = require('./src/services/emailService');
const InvoiceService = require('./src/services/invoiceService');
const fs = require('fs');

const runDiagnosis = async () => {
    console.log('--- STARTING PRODUCTION DIAGNOSIS ---');
    console.log(`Node Version: ${process.version}`);
    console.log(`Platform: ${process.platform}`);

    // 1. Check Environment Variables
    console.log('\n[1] Checking Environment Variables...');
    const requiredVars = [
        'EMAIL_USER',
        'EMAIL_PASS',
        'LINODE_OBJECT_BUCKET',
        'LINODE_OBJECT_STORAGE_ENDPOINT', // Used in invoiceService
        'AWS_ACCESS_KEY_ID',
        'AWS_SECRET_ACCESS_KEY'
    ];

    // Check main or fallback vars
    const emailUser = process.env.EMAIL_USER || process.env.SMARTCLINIC_EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS || process.env.SMARTCLINIC_EMAIL_PASS;

    if (emailUser) console.log('✓ EMAIL_USER (or SMARTCLINIC_EMAIL_USER) is set.');
    else console.error('❌ EMAIL_USER is MISSING.');

    if (emailPass) console.log('✓ EMAIL_PASS (or SMARTCLINIC_EMAIL_PASS) is set.');
    else console.error('❌ EMAIL_PASS is MISSING.');

    if (process.env.LINODE_OBJECT_BUCKET) console.log('✓ LINODE_OBJECT_BUCKET is set.');
    else console.error('❌ LINODE_OBJECT_BUCKET is MISSING.');

    // 2. Test Email Sending
    console.log('\n[2] Testing Email Sending...');
    if (emailUser && emailPass) {
        try {
            // Send to self/admin to verify
            const testEmail = process.argv[2] || emailUser; // Allow passing target email as arg
            console.log(`Sending test email to: ${testEmail}`);

            // Bypass the template for a raw simple test first
            await emailService.transporter.sendMail({
                from: emailUser,
                to: testEmail,
                subject: 'Production Diagnosis Test',
                text: 'If you received this, email sending is WORKING.'
            });
            console.log('✓ Email sent successfully.');
        } catch (err) {
            console.error('❌ Email Sending FAILED:', err.message);
            if (err.command === 'AUTH') console.error('  -> Hint: Check if App Password is required or expired.');
        }
    } else {
        console.log('Skipping email test due to missing credentials.');
    }

    // 3. Test Invoice Generation (PDF)
    console.log('\n[3] Testing PDF Generation (html-pdf-node)...');
    const invoiceService = new InvoiceService();
    try {
        const simpleHtml = '<h1>Test Invoice</h1><p>This is a test.</p>';
        console.log('Attempting to generate PDF buffer...');

        // Use the exact method from service, but we might want to catch specifically execution issues
        // The service uses `pdf.generatePdf`
        const buffer = await invoiceService.generatePDFBuffer(simpleHtml);

        if (Buffer.isBuffer(buffer) && buffer.length > 0) {
            console.log(`✓ PDF Generation successful. Buffer size: ${buffer.length} bytes.`);
        } else {
            console.error('❌ PDF Generation returned invalid result.');
        }
    } catch (err) {
        console.error('❌ PDF Generation FAILED:', err.message);
        console.error('  -> Stack:', err.stack);
        console.error('  -> Hint: Missing libraries? Try installing: libnss3, libatk1.0-0, libatk-bridge2.0-0, libcups2, libxkbcommon-x11-0, libxcomposite1, libxdamage1, libxfixes3, libxrandr2, libgbm1, libpango-1.0-0, libcairo2, libasound2');
    }

    // 4. Test S3 Upload
    console.log('\n[4] Testing S3 Upload...');
    try {
        const dummyBuffer = Buffer.from('Test File Content');
        console.log('Attempting to upload dummy file to S3...');
        const url = await invoiceService.uploadInvoiceToS3(dummyBuffer, 'TEST_DIAGNOSIS');
        console.log(`✓ S3 Upload successful: ${url}`);

        // Clean up
        console.log('Cleaning up test file...');
        await invoiceService.deleteInvoice(url);
        console.log('✓ Cleanup successful.');
    } catch (err) {
        console.error('❌ S3 Upload FAILED:', err.message);
    }

    console.log('\n--- DIAGNOSIS COMPLETE ---');
    process.exit(0);
};

runDiagnosis().catch(err => {
    console.error('Fatal Error running diagnosis:', err);
    process.exit(1);
});
