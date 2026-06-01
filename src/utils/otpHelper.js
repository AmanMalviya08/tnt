const crypto = require("crypto");
const https = require("https");
const axios = require("axios");
const DEFAULT_OTP_LENGTH = parseInt(process.env.PHONE_OTP_LENGTH || "6", 10);
const DEFAULT_EXPIRY_MINUTES = parseInt(
  process.env.PHONE_OTP_EXPIRY_MINUTES || "10",
  10
);
const dotenv = require("dotenv");
dotenv.config();
function generateNumericOtp(length = DEFAULT_OTP_LENGTH) {
  const digits = "0123456789";
  // let otp = "123456";
  let otp = "";
  for (let i = 0; i < length; i += 1) {
    const randomIndex = crypto.randomInt(0, digits.length);
    otp += digits[randomIndex];
  }
  return otp;
}

function getExpiryDate(minutes = DEFAULT_EXPIRY_MINUTES) {
  const expiry = new Date();
  expiry.setMinutes(expiry.getMinutes() + minutes);
  return expiry;
}

// const sendOtpViaMSG91 = async (mobile, otp) => {
//   console.log(mobile, otp);
//   return new Promise((resolve, reject) => {
//     const options = {
//       method: "POST",
//       hostname: "api.msg91.com",
//       path: "/api/v5/flow/",
//       headers: {
//         authkey: process.env.MSG_KEY,
//         "content-type": "application/json",
//       },
//     };

//     const req = https.request(options, (res) => {
//       const chunks = [];

//       res.on("data", (chunk) => chunks.push(chunk));

//       res.on("end", () => {
//         const body = Buffer.concat(chunks).toString();
//         console.log("OTP Sent:", body);
//         resolve(body);
//       });
//     });

//     req.on("error", (err) => {
//       console.error("Error sending OTP:", err);
//       reject(err);
//     });

//     const payload = {
//       flow_id: "63614b3dabf10640e61fa856",
//       sender: "DSMONL",
//       mobiles: `91${mobile}`,
//       otp: otp,
//     };

//     req.write(JSON.stringify(payload));
//     req.end();
//   });
// };

const sendOtpViaMSG91 = async (mobile, otp) => {
  try {
    const response = await axios.get(
      "https://api.msg91.com/api/sendhttp.php",
      {
        params: {
          authkey: process.env.MSG_KEY,
          mobiles: `91${mobile}`,
          message: `Dear Customer, Your OTP for login is ${otp}. Do not share this OTP with anyone.- Zunjarrao Yatra LLP`,
          sender: "ZNYTRA",
          route: "4",
          DLT_TE_ID: "1107177252965077896"
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
  generateNumericOtp,
  getExpiryDate,
  sendOtpViaMSG91,
  DEFAULT_OTP_LENGTH,
  DEFAULT_EXPIRY_MINUTES,
};
