const axios = require("axios");

class WhatsAppService {
  constructor() {
    this.enabled = process.env.WHATSAPP_ENABLED === "true";
    this.apiKey = process.env.AISENSY_API_KEY;
    this.baseUrl = "https://backend.aisensy.com/campaign/t1/api/v2";
  }

  async sendMessage(phone, options = {}) {
    if (!this.enabled) return { success: false, message: "WhatsApp disabled" };

    const formattedPhone = this.formatPhone(phone);
    console.log(`WhatsApp → ${formattedPhone}`);

    if (!this.apiKey) {
      return { success: false, message: "Aisensy API key missing" };
    }

    const userName = options.userName || "Customer";

    // 🟢 TEMPLATE
    if (options.templateName) {
      console.log("Sending template...");
      return this.sendTemplate(formattedPhone, options.variables, userName);
    }

    // 🟢 DOCUMENT
    if (options.documentUrl) {
      return this.sendDocument(formattedPhone, options.documentUrl, options.documentName, options.campaignName, userName, options.variables);
    }

    return { success: false, message: "Invalid request" };
  }

  async request(payload) {
    try {
      const { data } = await axios.post(this.baseUrl, payload);
      console.log("Aisensy Response:", data);
      return { success: true, data };
    } catch (err) {
      console.error("Aisensy Error:", err.response?.data || err.message);
      return { success: false, error: err.response?.data || err.message };
    }
  }

  // 🟢 TEMPLATE MESSAGE
  sendTemplate(phone, variables = [], userName = "Customer") {
    const safeUserName = (userName || "Customer").replace(/[^a-zA-Z0-9 ]/g, "").trim() || "Customer";
    return this.request({
      apiKey: this.apiKey,
      campaignName: "zn_booking", // exact template name
      destination: phone,
      userName: safeUserName,
      templateParams: variables,
      source: "api"
    });
  }

  // 🟢 DOCUMENT (PDF)
  sendDocument(phone, link, filename = "Invoice.pdf", campaignName, userName = "Customer", variables = []) {
    const safeUserName = (userName || "Customer").replace(/[^a-zA-Z0-9 ]/g, "").trim() || "Customer";
    const payload = {
      apiKey: this.apiKey,
      destination: phone,
      userName: safeUserName,
      source: "api",
      media: {
        url: link,
        filename: filename
      }
    };

    if (campaignName) {
      payload.campaignName = campaignName;
      if (variables && variables.length > 0) {
        payload.templateParams = variables;
      }
    }

    return this.request(payload);
  }

  formatPhone(phone) {
    let cleaned = phone.replace(/\D/g, "");

    if (cleaned.length === 10) return `91${cleaned}`;
    if (cleaned.startsWith("0")) return `91${cleaned.slice(1)}`;

    return cleaned;
  }
}

module.exports = WhatsAppService;