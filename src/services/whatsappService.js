const axios = require("axios");

class WhatsAppService {
  constructor() {
    this.enabled = process.env.WHATSAPP_ENABLED === "true";
    this.aisensyApiKey = process.env.AISENSY_API_KEY;
    this.aisensyBaseUrl = "https://backend.aisensy.com/campaign/t1/api/v2";

    this.cloudToken = process.env.WHATSAPP_CLOUD_API_TOKEN;
    this.cloudPhoneNumberId = (process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID || "")
      .split("#")[0]
      .trim();
    this.cloudApiVersion = (process.env.WHATSAPP_CLOUD_API_VERSION || "v20.0")
      .split("#")[0]
      .trim();
    this.cloudTemplateName =
      process.env.WHATSAPP_BOOKING_TEMPLATE || "zn_booking";
  }

  get isCloudConfigured() {
    return Boolean(this.cloudToken && this.cloudPhoneNumberId);
  }

  async sendMessage(phone, options = {}) {
    if (!this.enabled) {
      const err = new Error("WhatsApp disabled (set WHATSAPP_ENABLED=true)");
      console.warn("[WhatsApp]", err.message);
      throw err;
    }

    const formattedPhone = this.formatPhone(phone);
    const userName = options.userName || "Customer";
    console.log(`[WhatsApp] Sending to ${formattedPhone}`);

    if (options.templateName || options.variables) {
      const variables = options.variables || [];
      const templateName = options.templateName || this.cloudTemplateName;

      if (this.isCloudConfigured) {
        const cloudResult = await this.sendCloudTemplate(
          formattedPhone,
          templateName,
          variables
        );
        if (cloudResult.success) return cloudResult;
        console.warn(
          "[WhatsApp] Cloud API failed, trying Aisensy:",
          cloudResult.error
        );
      }

      if (this.aisensyApiKey) {
        return this.sendAisensyTemplate(formattedPhone, variables, userName);
      }

      throw new Error(
        "No WhatsApp provider configured (Cloud API token or AISENSY_API_KEY required)"
      );
    }

    if (options.documentUrl) {
      if (this.isCloudConfigured) {
        return this.sendCloudDocument(
          formattedPhone,
          options.documentUrl,
          options.documentName || "Invoice.pdf"
        );
      }
      if (this.aisensyApiKey) {
        return this.sendAisensyDocument(
          formattedPhone,
          options.documentUrl,
          options.documentName,
          options.campaignName,
          userName,
          options.variables
        );
      }
      throw new Error("No WhatsApp provider configured for document send");
    }

    throw new Error("Invalid WhatsApp request: templateName or documentUrl required");
  }

  async sendCloudTemplate(phone, templateName, variables = []) {
    const url = `https://graph.facebook.com/${this.cloudApiVersion}/${this.cloudPhoneNumberId}/messages`;

    const bodyParams = variables.map((value) => ({
      type: "text",
      text: String(value ?? "-"),
    }));

    const payload = {
      messaging_product: "whatsapp",
      to: phone,
      type: "template",
      template: {
        name: templateName,
        language: { code: "en" },
        components:
          bodyParams.length > 0
            ? [{ type: "body", parameters: bodyParams }]
            : undefined,
      },
    };

    try {
      const { data } = await axios.post(url, payload, {
        headers: {
          Authorization: `Bearer ${this.cloudToken}`,
          "Content-Type": "application/json",
        },
        timeout: 30000,
      });
      console.log("[WhatsApp] Cloud API template sent:", data);
      return { success: true, provider: "cloud", data };
    } catch (err) {
      const error = err.response?.data || err.message;
      console.error("[WhatsApp] Cloud API error:", error);
      return { success: false, provider: "cloud", error };
    }
  }

  async sendCloudDocument(phone, documentUrl, filename) {
    const url = `https://graph.facebook.com/${this.cloudApiVersion}/${this.cloudPhoneNumberId}/messages`;
    const payload = {
      messaging_product: "whatsapp",
      to: phone,
      type: "document",
      document: {
        link: documentUrl,
        filename,
      },
    };

    try {
      const { data } = await axios.post(url, payload, {
        headers: {
          Authorization: `Bearer ${this.cloudToken}`,
          "Content-Type": "application/json",
        },
        timeout: 30000,
      });
      return { success: true, provider: "cloud", data };
    } catch (err) {
      const error = err.response?.data || err.message;
      console.error("[WhatsApp] Cloud document error:", error);
      return { success: false, provider: "cloud", error };
    }
  }

  async sendAisensyTemplate(phone, variables = [], userName = "Customer") {
    const safeUserName =
      (userName || "Customer").replace(/[^a-zA-Z0-9 ]/g, "").trim() || "Customer";

    const result = await this.aisensyRequest({
      apiKey: this.aisensyApiKey,
      campaignName: "zn_booking",
      destination: phone,
      userName: safeUserName,
      templateParams: variables,
      source: "api",
    });

    if (!result.success) {
      throw new Error(
        `Aisensy failed: ${JSON.stringify(result.error || result.message)}`
      );
    }
    return result;
  }

  async sendAisensyDocument(
    phone,
    link,
    filename = "Invoice.pdf",
    campaignName,
    userName = "Customer",
    variables = []
  ) {
    const safeUserName =
      (userName || "Customer").replace(/[^a-zA-Z0-9 ]/g, "").trim() || "Customer";
    const payload = {
      apiKey: this.aisensyApiKey,
      destination: phone,
      userName: safeUserName,
      source: "api",
      media: { url: link, filename },
    };

    if (campaignName) {
      payload.campaignName = campaignName;
      if (variables?.length) payload.templateParams = variables;
    }

    const result = await this.aisensyRequest(payload);
    if (!result.success) {
      throw new Error(`Aisensy document failed: ${JSON.stringify(result.error)}`);
    }
    return result;
  }

  async aisensyRequest(payload) {
    try {
      const { data } = await axios.post(this.aisensyBaseUrl, payload, {
        timeout: 30000,
      });
      console.log("[WhatsApp] Aisensy response:", data);
      return { success: true, provider: "aisensy", data };
    } catch (err) {
      const error = err.response?.data || err.message;
      console.error("[WhatsApp] Aisensy error:", error);
      return { success: false, provider: "aisensy", error };
    }
  }

  formatPhone(phone) {
    let cleaned = String(phone || "").replace(/\D/g, "");
    if (cleaned.length === 10) return `91${cleaned}`;
    if (cleaned.startsWith("0")) return `91${cleaned.slice(1)}`;
    return cleaned;
  }
}

module.exports = WhatsAppService;
