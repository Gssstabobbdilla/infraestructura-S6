const path = require('node:path');
const sharp = require('sharp');
const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const mask = Buffer.from('<svg width="40" height="40"><circle cx="20" cy="20" r="20" fill="white"/></svg>');

function createHandler({ s3 = new S3Client({}), env = process.env } = {}) {
  return async event => {
    const batchItemFailures = [];
    for (const message of event.Records || []) {
      try {
        const notification = JSON.parse(message.body);
        // S3 sends this when enabling notifications; it is not an image job.
        if (notification.Event === 's3:TestEvent') continue;
        if (!Array.isArray(notification.Records) || !notification.Records.length) throw new Error('Invalid S3 notification');
        for (const record of notification.Records) {
          if (record.eventSource !== 'aws:s3' || !record.eventName?.startsWith('ObjectCreated:')) throw new Error('Unexpected S3 event');
          const bucket = record.s3.bucket.name;
          const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
          if (bucket !== env.S3_BUCKET || !key.startsWith(env.UPLOAD_PREFIX || 'uploads/')) throw new Error('Unexpected bucket or prefix');
          if (record.s3.object.size > 4 * 1024 * 1024) throw new Error('Image exceeds 4 MB');
          const original = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
          if (original.ContentLength > 4 * 1024 * 1024) throw new Error('Image exceeds 4 MB');
          const image = await original.Body.transformToByteArray();
          if (image.length > 4 * 1024 * 1024) throw new Error('Image exceeds 4 MB');
          const output = await sharp(image, { limitInputPixels: 40000000 })
            .rotate().resize(40, 40, { fit: 'cover' }).ensureAlpha()
            .composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
          // Deterministic key: retries overwrite the same result instead of creating new files.
          const relative = key.slice((env.UPLOAD_PREFIX || 'uploads/').length);
          const outputKey = `${env.PROCESSED_PREFIX || 'processed/'}${relative.slice(0, relative.length - path.extname(relative).length)}_circular.png`;
          await s3.send(new PutObjectCommand({ Bucket: bucket, Key: outputKey, Body: output, ContentType: 'image/png' }));
        }
      } catch (error) {
        console.error('Crop failed for message:', message.messageId, error.message);
        batchItemFailures.push({ itemIdentifier: message.messageId });
      }
    }
    return { batchItemFailures };
  };
}
exports.createHandler = createHandler;
exports.handler = createHandler();
