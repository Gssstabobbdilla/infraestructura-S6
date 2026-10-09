import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import sharp from '../src/lambdas/crop/node_modules/sharp/lib/index.js';
import { createHandler as upload } from '../src/lambdas/upload/index.mjs';
import { createHandler as crop } from '../src/lambdas/crop/index.mjs';

process.env.S3_BUCKET = 'test-images';
process.env.UPLOAD_PREFIX = 'uploads/';
process.env.PROCESSED_PREFIX = 'processed/';
const image = () => sharp({ create: { width: 80, height: 60, channels: 3, background: 'red' } }).png().toBuffer();
const json = imageBase64 => ({ headers: { 'content-type': 'application/json' }, body: JSON.stringify({ imageBase64 }) });
const record = (messageId, key = 'uploads/photo.png') => ({ messageId, body: JSON.stringify({ Records: [{ s3: { bucket: { name: 'test-images' }, object: { key } } }] }) });

test('JSON guarda los bytes de la imagen, no el texto JSON', async () => {
  const original = await image();
  let write;
  const response = await upload({ send: async command => { write = command.input; } })(json(original.toString('base64')));
  assert.equal(response.statusCode, 202);
  assert.deepEqual(write.Body, original);
  assert.equal(JSON.parse(response.body).uploadKey, write.Key);
});

test('multipart acepta encabezados con mayusculas y cuerpo binario base64', async () => {
  const original = await image();
  const body = Buffer.concat([Buffer.from('--boundary\r\nContent-Disposition: form-data; name="file"; filename="photo.png"\r\nContent-Type: image/png\r\n\r\n'), original, Buffer.from('\r\n--boundary--\r\n')]);
  let write;
  const response = await upload({ send: async command => { write = command.input; } })({ headers: { 'Content-Type': 'multipart/form-data; boundary=boundary' }, isBase64Encoded: true, body: body.toString('base64') });
  assert.equal(response.statusCode, 202);
  assert.deepEqual(write.Body, original);
});

test('JSON malformado, formulario roto y cargas grandes se rechazan sin guardar', async () => {
  let calls = 0;
  const handler = upload({ send: async () => { calls++; } });
  assert.equal((await handler({ headers: { 'content-type': 'application/json' }, body: '{' })).statusCode, 400);
  assert.equal((await handler({ headers: { 'content-type': 'multipart/form-data' }, body: 'broken' })).statusCode, 400);
  assert.equal((await handler(json(Buffer.from('not an image').toString('base64')))).statusCode, 415);
  assert.equal((await handler(json(Buffer.alloc(4 * 1024 * 1024 + 1).toString('base64')))).statusCode, 413);
  assert.equal(calls, 0);
});

test('crop produce PNG circular 40x40 con esquinas transparentes', async () => {
  const original = await image();
  let write;
  const handler = crop({ send: async command => {
    if (command.constructor.name === 'GetObjectCommand') return { Body: Readable.from([original]) };
    write = command.input;
  } });
  assert.deepEqual(await handler({ Records: [record('ok')] }), { batchItemFailures: [] });
  assert.equal(write.Key, 'processed/photo.png');
  const metadata = await sharp(write.Body).metadata();
  assert.equal(metadata.width, 40);
  assert.equal(metadata.height, 40);
  const pixels = await sharp(write.Body).raw().toBuffer();
  assert.equal(pixels[3], 0);
  assert.equal(pixels[(20 * 40 + 20) * 4 + 3], 255);
});

test('solo los mensajes fallidos se reintentan; los siguientes siguen procesandose', async () => {
  const original = await image();
  const writes = [];
  const handler = crop({ send: async command => {
    if (command.constructor.name === 'GetObjectCommand') {
      if (command.input.Key === 'uploads/fail.png') throw new Error('S3 unavailable');
      return { Body: Readable.from([original]) };
    }
    writes.push(command.input);
  } });
  const result = await handler({ Records: [record('bad', 'uploads/fail.png'), record('ok'), { messageId: 'malformed', body: '{' }, { messageId: 'test', body: JSON.stringify({ Event: 's3:TestEvent' }) }] });
  assert.deepEqual(result, { batchItemFailures: [{ itemIdentifier: 'bad' }, { itemIdentifier: 'malformed' }] });
  assert.equal(writes.length, 1);
});

test('crop procesa todos los objetos de una notificacion S3', async () => {
  const original = await image();
  const writes = [];
  const handler = crop({ send: async command => {
    if (command.constructor.name === 'GetObjectCommand') return { Body: Readable.from([original]) };
    writes.push(command.input.Key);
  } });
  const message = record('multi');
  const payload = JSON.parse(message.body);
  payload.Records.push({ s3: { bucket: { name: 'test-images' }, object: { key: 'uploads/second.png' } } });
  message.body = JSON.stringify(payload);
  assert.deepEqual(await handler({ Records: [message] }), { batchItemFailures: [] });
  assert.deepEqual(writes, ['processed/photo.png', 'processed/second.png']);
});
