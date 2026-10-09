import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { v4 as generateUUID } from 'uuid';
import busboyParser from 'busboy';

const s3ClientInstance = new S3Client({});

const extractMultipartData = (incomingEvent) => {
    return new Promise((resolveOperation, rejectOperation) => {
        const parserInstance = busboyParser({ headers: incomingEvent.headers });
        let extractedBuffer = null;
        let detectedMime = 'image/png';

        parserInstance.on('file', (fieldName, fileStream, fileInfo) => {
            detectedMime = fileInfo.mimeType || 'image/png';
            const dataChunks = [];
            
            fileStream.on('data', (piece) => dataChunks.push(piece));
            fileStream.on('end', () => {
                extractedBuffer = Buffer.concat(dataChunks);
            });
        });

        parserInstance.on('finish', () => resolveOperation({ extractedBuffer, detectedMime }));
        parserInstance.on('error', rejectOperation);

        const rawPayload = incomingEvent.isBase64Encoded
            ? Buffer.from(incomingEvent.body, 'base64')
            : Buffer.from(incomingEvent.body, 'utf8');

        parserInstance.write(rawPayload);
        parserInstance.end();
    });
};

export const handler = async (lambdaEvent) => {
    console.log("Invocación registrada:", JSON.stringify(lambdaEvent));
    
    try {
        const targetBucketName = process.env.S3_BUCKET;
        const targetPrefix = process.env.UPLOAD_PREFIX;
        
        const headerMap = lambdaEvent.headers || {};
        const mediaTypeHeader = headerMap['content-type'] || headerMap['Content-Type'] || '';
        const generatedFileName = `${generateUUID()}.png`;

        let activeBuffer;
        let activeMimeType;

        if (mediaTypeHeader.includes('multipart/form-data')) {
            const multipartResult = await extractMultipartData(lambdaEvent);
            activeBuffer = multipartResult.extractedBuffer;
            activeMimeType = multipartResult.detectedMime;
        } else {
            activeBuffer = lambdaEvent.isBase64Encoded
                ? Buffer.from(lambdaEvent.body, 'base64')
                : Buffer.from(lambdaEvent.body);
            activeMimeType = mediaTypeHeader || 'image/png';
        }

        if (!activeBuffer || activeBuffer.length === 0) {
            throw new Error("El contenido del archivo multimedia se encuentra vacío");
        }

        await s3ClientInstance.send(
            new PutObjectCommand({
                Bucket: targetBucketName,
                Key: `${targetPrefix}${generatedFileName}`,
                Body: activeBuffer,
                ContentType: activeMimeType
            })
        );

        return {
            statusCode: 201,
            body: JSON.stringify({ 
                msg: "Archivo cargado con éxito", 
                filename: generatedFileName 
            })
        };
        
    } catch (failureException) {
        console.error("FALLO EN LA EJECUCIÓN:", failureException.message);
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                errorDescription: failureException.message, 
                trace: failureException.stack 
            })
        };
    }
};