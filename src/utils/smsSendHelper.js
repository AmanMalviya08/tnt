const https = require("https");
const axios = require("axios");


//  const sendBookingSMS = (mobile, name, bookingId, invoiceLink) => {
//   const data = JSON.stringify({
//     flow_id: "63614b3dabf10640e61fa856",
//     sender: "DSMONL",
//     mobiles: `91${mobile}`,
//     name: name,
//     booking_id: bookingId,
//     invoice_link: invoiceLink
//   });
//   // 1107177339794725613
  
//   const options = {
//     method: "POST",
//     hostname: "api.msg91.com",
//     path: "/api/v5/flow/",
//     headers: {
//       authkey: process.env.MSG_KEY,
//       "content-type": "application/json",
//       "content-length": data.length,
//     },
//   };

//   const req = https.request(options, (res) => {
//     let chunks = [];

//     res.on("data", (chunk) => chunks.push(chunk));

//     res.on("end", () => {
//       console.log("SMS Sent:", Buffer.concat(chunks).toString());
//     });
//   });

//   req.write(data);
//   req.end();
// };




// https://api.zunjarraoyatra.com/api/checkout/invoice?id=BK-20260319-170815-123456
// 1114069913554859546
const sendBookingSMS = async (mobile,name, bookingId, invoiceLink) => {
  console.log("=============",mobile,name, bookingId, invoiceLink);
  try { 
    // const invoiceId = 123456789;
    const url = `https://api.zunjarraoyatra.com/api/checkout/invoice?id=${bookingId}`;
    console.log("url",url);
    const cleanMobile = mobile.toString().replace(/\D/g, ''); // Removes '+' and spaces
    const finalMobile = cleanMobile.startsWith('91') ? cleanMobile : `91${cleanMobile}`;
    
    const response = await axios.get(
      "https://api.msg91.com/api/sendhttp.php",
      {
        params: {
          authkey: process.env.MSG_KEY || "441431AI59GlvFlw69aaa86dP1",
          mobiles: finalMobile,
          message: `Hello ${name}, your booking ${bookingId} has been confirmed for ${url}. Thank you for choosing our service. -ZUNJARRAO YATRA LLP`,
          sender: "ZNYTRA",
          route: "4",
          DLT_TE_ID: "1107177339794725613"
        },
      }
    );

    console.log("SMS Sent:", response.data);
    // sendhttp.php returns a request ID string on success.
    // We return an object to remain compatible with controller logic.
    return { type: 'success', data: response.data };
  } catch (error) {
    const errorMsg = error.response?.data || error.message;
    console.error("Error sending SMS:", errorMsg);
    return { type: 'error', message: errorMsg };
  }
};

module.exports = {
  sendBookingSMS,
};
