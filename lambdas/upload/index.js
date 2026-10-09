const { randomUUID } = require('node:crypto');
const Busboy = require('busboy');
const sharp = require('sharp');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const MAX_BYTES = 4 * 1024 * 1024;
const formats = { jpeg: ['jpg', 'image/jpeg'], png: ['png', 'image/png'], gif: ['gif', 'image/gif'], webp: ['webp', 'image/webp'] };
class InputError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
function decodeBase64(value) {
  if (typeof value !== 'string' || !value.length || value.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
    throw new InputError('imageBase64 debe contener base64 valido.');
  }
  if (value.length > Math.ceil(MAX_BYTES / 3) * 4) throw new InputError('La imagen supera 4 MB.', 413);
  return Buffer.from(value, 'base64');
}
function parseMultipart(body, contentType) {
  return new Promise((resolve, reject) => {
    let file;
    let invalid = false;
    let parser;
    try {
      parser = Busboy({ headers: { 'content-type': contentType }, limits: { files: 1, fileSize: MAX_BYTES, fields: 0, parts: 2 } });
    } catch {
      reject(new InputError('Formulario multipart invalido: falta el boundary.'));
      return;
    }
    parser.on('file', (name, stream) => {
      const chunks = [];
      if (name !== 'image') invalid = true;
      stream.on('data', chunk => chunks.push(chunk));
      stream.on('limit', () => { invalid = true; });
      stream.on('error', reject);
      stream.on('end', () => { file = Buffer.concat(chunks); });
    });
    for (const event of ['filesLimit', 'fieldsLimit', 'partsLimit']) parser.on(event, () => { invalid = true; });
    parser.on('error', () => reject(new InputError('Formulario multipart invalido.')));
    parser.on('close', () => {
      if (invalid || !file?.length) reject(new InputError('Envia un unico archivo image de hasta 4 MB.'));
      else resolve(file);
    });
    parser.end(body);
  });
}
function createHandler({ s3 = new S3Client({}), env = process.env } = {}) {
  return async event => {
    try {
      const contentType = Object.entries(event.headers || {}).find(([key]) => key.toLowerCase() === 'content-type')?.[1] || '';
      if (typeof event.body !== 'string' || !event.body.length) throw new InputError('Falta la imagen.');
      // Incluye margen para el formulario y evita decodificar cuerpos arbitrariamente grandes.
      if (Buffer.byteLength(event.body) > Math.ceil(MAX_BYTES / 3) * 4 + 65536) throw new InputError('La solicitud es demasiado grande.', 413);
      const body = Buffer.from(event.body, event.isBase64Encoded ? 'base64' : 'utf8');
      let image;
      if (/^application\/json(?:;|$)/i.test(contentType)) {
        let payload;
        try { payload = JSON.parse(body.toString('utf8')); } catch { throw new InputError('JSON invalido.'); }
        image = decodeBase64(payload.imageBase64);
      } else if (/^multipart\/form-data(?:;|$)/i.test(contentType)) {
        image = await parseMultipart(body, contentType);
      } else throw new InputError('Usa application/json o multipart/form-data.', 415);
      if (!image.length || image.length > MAX_BYTES) throw new InputError('La imagen debe tener entre 1 byte y 4 MB.', 413);
      let metadata;
      try { metadata = await sharp(image, { limitInputPixels: 40000000 }).metadata(); }
      catch { throw new InputError('El archivo no es una imagen valida.', 415); }
      const format = formats[metadata.format];
      if (!format) throw new InputError('Formatos permitidos: JPG, PNG, GIF y WebP.', 415);
      if (!env.S3_BUCKET) throw new Error('Falta S3_BUCKET');
      const id = randomUUID();
      const key = `${env.UPLOAD_PREFIX || 'uploads/'}${id}.${format[0]}`;
      await s3.send(new PutObjectCommand({ Bucket: env.S3_BUCKET, Key: key, Body: image, ContentType: format[1] }));
      return { statusCode: 202, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, uploadKey: key, processedKey: `processed/${id}_circular.png`, status: 'queued' }) };
    } catch (error) {
      if (!(error instanceof InputError)) console.error('Upload failed:', error);
      return { statusCode: error.status || 500, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ error: error instanceof InputError ? error.message : 'No se pudo guardar la imagen.' }) };
    }
  };
}
exports.createHandler = createHandler;
exports.handler = createHandler();
