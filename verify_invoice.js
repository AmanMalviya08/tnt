const InvoiceService = require('./src/services/invoiceService');
const fs = require('fs');
const path = require('path');

const mockBooking = {
    invoiceNumber: 'INV-2024-001',
    createdAt: new Date(),
    bookingId: 'BK-123456',
    paymentStatus: 'Paid',
    bookingStatus: 'Confirmed',
    customerName: 'John Doe',
    mobileNumber: '+91-9876543210',
    email: 'john.doe@example.com',
    userType: 'App User',
    bookingType: 'Package',
    travelStartDate: new Date('2024-12-01'),
    travelEndDate: new Date('2024-12-05'),
    durationInDays: 5,
    numberOfTravelers: 2,
    selectedPackageId: {
        title: 'Amazing Goa Trip',
        basePricePerPerson: 15000,
        childPrice: 8000
    },
    adults: 2,
    children: 0,
    packageCostPerPerson: 15000,
    totalAmount: 30000,
    discountAmount: 0,
    finalAmount: 30000,
    addOnsTotal: 0,
    paymentMethod: 'UPI',
    transactionId: 'TXN123456789',
    travelerDetails: [
        { name: 'John Doe', age: 30, gender: 'Male' },
        { name: 'Jane Doe', age: 28, gender: 'Female' }
    ]
};

async function generateTestInvoice() {
    try {
        console.log('Generating invoice PDF via Puppeteer...');
        const invoiceService = new InvoiceService();
        const pdfBuffer = await invoiceService.generatePDFBuffer(mockBooking);

        const outputPath = path.join(__dirname, 'test_invoice.pdf');
        fs.writeFileSync(outputPath, pdfBuffer);

        console.log(`Invoice generated successfully at: ${outputPath}`);
    } catch (error) {
        console.error('Error generating invoice:', error);
    }
}

generateTestInvoice();
