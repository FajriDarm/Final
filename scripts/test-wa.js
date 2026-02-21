const whatsapp = require('../services/whatsappService');

(async () => {
  try {
    // provider=mock (default in dev), WA_FORCE_TO is set to +6287888669113 by default in service
    const res = await whatsapp.sendTextWA('081200000123', 'Test WA message — ini tes otomatis.');
    console.log('sendTextWA result =>', res);
  } catch (err) {
    console.error('sendTextWA error =>', err && (err.message || err));
  }
})();