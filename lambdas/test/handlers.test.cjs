const { test } = require('node:test');
const assert = require('node:assert/strict');
const sharp = require('sharp');
const { createHandler: upload } = require('../upload');
const { createHandler: crop } = require('../crop');
const env = { S3_BUCKET: 'test-images', UPLOAD_PREFIX: 'uploads/', PROCESSED_PREFIX: 'processed/' };
const sample = () => sharp({ create: { width: 80, height: 60, channels: 3, background: 'red' } }).png().toBuffer();
const jsonEvent = imageBase64 => ({ headers: { 'content-type': 'application/json' }, body: JSON.stringify({ imageBase64 }) });
const job = (id, key = 'uploads/sample.png') => ({ messageId: id, body: JSON.stringify({ Records: [{ eventSource: 'aws:s3', eventName: 'ObjectCreated:Put', s3: { bucket: { name: env.S3_BUCKET }, object: { key } } }] }) });

test('JSON upload stores original bytes and returns a queued job', async () => {
  const image = await sample();
  const writes = [];
  const handler = upload({ env, s3: { send: async command => writes.push(command.input) } });
  const response = await handler(jsonEvent(image.toString('base64')));
  assert.equal(response.statusCode, 202);
  const result = JSON.parse(response.body);
  assert.match(result.uploadKey, /^uploads\/[\w-]+\.png$/);
  assert.equal(result.processedKey, `processed/${result.id}_circular.png`);
  assert.equal(writes[0].Bucket, env.S3_BUCKET);
  assert.deepEqual(writes[0].Body, image);
});

test('multipart upload decodes the binary API Gateway body', async () => {
  const image = await sample();
  const body = Buffer.concat([Buffer.from('--testboundary\r\nContent-Disposition: form-data; name="image"; filename="photo.png"\r\nContent-Type: image/png\r\n\r\n'), image, Buffer.from('\r\n--testboundary--\r\n')]);
  const writes = [];
  const response = await upload({ env, s3: { send: async command => writes.push(command.input) } })({
    headers: { 'Content-Type': 'multipart/form-data; boundary=testboundary' }, isBase64Encoded: true, body: body.toString('base64')
  });
  assert.equal(response.statusCode, 202);
  assert.deepEqual(writes[0].Body, image);
});

test('invalid JSON, base64, unsupported files and oversize images are not stored', async () => {
  let writes = 0;
  const handler = upload({ env, s3: { send: async () => { writes++; } } });
  assert.equal((await handler({ headers: { 'content-type': 'application/json' }, body: '{' })).statusCode, 400);
  assert.equal((await handler(jsonEvent('???'))).statusCode, 400);
  assert.equal((await handler({ headers: { 'content-type': 'multipart/form-data' }, body: 'broken' })).statusCode, 400);
  assert.equal((await handler(jsonEvent(Buffer.from('not an image').toString('base64')))).statusCode, 415);
  assert.equal((await handler(jsonEvent(Buffer.alloc(4 * 1024 * 1024 + 1).toString('base64')))).statusCode, 413);
  assert.equal(writes, 0);
});

test('upload does not claim a queued job when S3 fails', async () => {
  const image = await sample();
  const handler = upload({ env, s3: { send: async () => { throw new Error('S3 unavailable'); } } });
  const response = await handler(jsonEvent(image.toString('base64')));
  assert.equal(response.statusCode, 500);
  assert.equal(JSON.parse(response.body).status, undefined);
});

test('crop writes a 40x40 PNG with transparent corners and an opaque center', async () => {
  const image = await sample();
  const writes = [];
  const handler = crop({ env, s3: { send: async command => {
    if (command.constructor.name === 'GetObjectCommand') return { Body: { transformToByteArray: async () => image } };
    writes.push(command.input);
  } } });
  assert.deepEqual(await handler({ Records: [job('ok')] }), { batchItemFailures: [] });
  assert.equal(writes[0].Key, 'processed/sample_circular.png');
  const metadata = await sharp(writes[0].Body).metadata();
  assert.equal(metadata.width, 40);
  assert.equal(metadata.height, 40);
  assert.equal(metadata.format, 'png');
  assert.equal(metadata.hasAlpha, true);
  const pixels = await sharp(writes[0].Body).raw().toBuffer();
  assert.equal(pixels[3], 0);
  assert.equal(pixels[(20 * 40 + 20) * 4 + 3], 255);
  await handler({ Records: [job('retry')] });
  assert.equal(writes[1].Key, writes[0].Key);
});

test('crop reports only failed SQS items and acknowledges the S3 test event', async () => {
  const image = await sample();
  const writes = [];
  const handler = crop({ env, s3: { send: async command => {
    if (command.constructor.name === 'GetObjectCommand') return { Body: { transformToByteArray: async () => image } };
    writes.push(command.input);
  } } });
  const response = await handler({ Records: [job('ok', 'uploads/photo+one.png'), job('bad', 'processed/forbidden.png'), { messageId: 'test', body: JSON.stringify({ Event: 's3:TestEvent' }) }] });
  assert.deepEqual(response, { batchItemFailures: [{ itemIdentifier: 'bad' }] });
  assert.equal(writes[0].Key, 'processed/photo one_circular.png');
});
