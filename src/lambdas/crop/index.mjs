import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from 'sharp';

const s3Manager = new S3Client({});

const convertStreamToBuffer = async (readableStream) => {
    const streamChunks = [];
    let totalBytes = 0;
    for await (const item of readableStream) {
        totalBytes += item.length;
        if (totalBytes > 4 * 1024 * 1024) throw new Error('La imagen supera 4 MiB');
        streamChunks.push(item);
    }
    return Buffer.concat(streamChunks);
};

export const createHandler = (client = s3Manager) => async (event) => {
    const batchItemFailures = [];
    for (const recordItem of event.Records) {
      try {
        const payload = JSON.parse(recordItem.body);
        
        if (payload.Event === "s3:TestEvent") {
            console.log("Bypassing S3 notification test event");
            continue;
        }
        
        if (!Array.isArray(payload.Records) || !payload.Records.length) throw new Error('Notificacion S3 invalida');
        for (const s3Record of payload.Records) {
        const s3Details = s3Record.s3;
        const targetBucket = s3Details.bucket.name;
        const objectKey = decodeURIComponent(s3Details.object.key.replace(/\+/g, ' '));
        if (targetBucket !== process.env.S3_BUCKET || !objectKey.startsWith('uploads/')) throw new Error('Bucket o prefijo inesperado');

        try {
            // 1. Descarga del archivo
            const getResponse = await client.send(
                new GetObjectCommand({ Bucket: targetBucket, Key: objectKey })
            );
            if (getResponse.ContentLength > 4 * 1024 * 1024) throw new Error('La imagen supera 4 MiB');
            
            const originalBuffer = await convertStreamToBuffer(getResponse.Body);
            if (originalBuffer.length > 4 * 1024 * 1024) throw new Error('La imagen supera 4 MiB');

            // 2. SVG
            const circularMask = Buffer.from(
                '<svg width="40" height="40"><circle cx="20" cy="20" r="20" fill="white" /></svg>'
            );

            // 3. Procesamiento de imagen con Sharp
            const outputBuffer = await sharp(originalBuffer, { limitInputPixels: 40000000 })
                .rotate()
                .resize(40, 40, { fit: 'cover' })
                .ensureAlpha()
                .composite([{
                    input: circularMask,
                    blend: 'dest-in'
                }])
                .png()
                .toBuffer();

            // 4. Se gnera la nueva ruta de saldia
            const resultKey = objectKey
                .replace('uploads/', process.env.PROCESSED_PREFIX || 'processed/')
                .replace(/\.[^.]+$/, '.png');

            // 5. Almacenamiento del resultado
            await client.send(
                new PutObjectCommand({
                    Bucket: targetBucket,
                    Key: resultKey,
                    Body: outputBuffer,
                    ContentType: 'image/png'
                })
            );

            console.log(`Imagen procesada correctamente: ${resultKey}`);
        } catch (err) {
            console.error(`Error durante el procesamiento de ${objectKey}:`, err);
            throw err;
        }
        }
      } catch (error) {
        console.error('Mensaje fallido:', recordItem.messageId, error.message);
        batchItemFailures.push({ itemIdentifier: recordItem.messageId });
      }
    }
    return { batchItemFailures };
};

export const handler = createHandler();
