const w = require('../services/whatsappService');
console.log('normalizePhone(081200000123) =>', w.normalizePhone('081200000123'));
console.log('WA_COPY_TO (from process.env) =>', process.env.WA_COPY_TO);
console.log('WA_FORCE_TO (from process.env) =>', process.env.WA_FORCE_TO);
console.log('WA_COPY_TO (from service constant) =>', (process.env.WA_COPY_TO || (process.env.NODE_ENV !== 'production' ? '+6287888669113' : null)));
