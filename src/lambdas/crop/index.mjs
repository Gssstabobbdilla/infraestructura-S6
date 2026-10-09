import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from 'sharp';

const s3Manager = new S3Client({});

const convertStreamToBuffer = async (readableStream) => {
    const streamChunks = [];
    for await (const item of readableStream) {
        streamChunks.push(item);
    }
    return Buffer.concat(streamChunks);
};

export const handler = async (event) => {
    for (const recordItem of event.Records) {
        const payload = JSON.parse(recordItem.body);
        
        if (payload.Event === "s3:TestEvent") {
            console.log("Bypassing S3 notification test event");
            continue;
        }
        
        const s3Details = payload.Records[0].s3;
        const targetBucket = s3Details.bucket.name;
        const objectKey = decodeURIComponent(s3Details.object.key.replace(/\+/g, ' '));

        try {
            // 1. Descarga del archivo
            const getResponse = await s3Manager.send(
                new GetObjectCommand({ Bucket: targetBucket, Key: objectKey })
            );
            
            const originalBuffer = await convertStreamToBuffer(getResponse.Body);

            // 2. SVG
            const circularMask = Buffer.from(
                '<svg><circle cx="20" cy="20" r="20" /></svg>'
            );

            // 3. Procesamiento de imagen con Sharp
            const outputBuffer = await sharp(originalBuffer)
                .resize(40, 40, { fit: 'cover' })
                .composite([{
                    input: circularMask,
                    blend: 'dest-in'
                }])
                .png()
                .toBuffer();

            // 4. Se gnera la nueva ruta de saldia
            const resultKey = objectKey
                .replace('uploads/', 'processed/')
                .replace(/\.[^.]+$/, '.png');

            // 5. Almacenamiento del resultado
            await s3Manager.send(
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
};