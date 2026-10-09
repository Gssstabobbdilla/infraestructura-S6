import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { v4 as generateUUID } from 'uuid';
import busboyParser from 'busboy';

const s3ClientInstance = new S3Client({});
const MAX_BYTES = 4 * 1024 * 1024;
const allowedTypes = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp' };
const inputError = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
const detectImageType = (buffer) => {
    if (buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
    if (buffer.subarray(0, 3).equals(Buffer.from([255, 216, 255]))) return 'image/jpeg';
    if (['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString('ascii'))) return 'image/gif';
    if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
    return null;
};

const extractMultipartData = (incomingEvent) => {
    return new Promise((resolveOperation, rejectOperation) => {
        const normalizedHeaders = Object.fromEntries(Object.entries(incomingEvent.headers || {}).map(([key, value]) => [key.toLowerCase(), value]));
        let parserInstance;
        try {
            parserInstance = busboyParser({ headers: normalizedHeaders, limits: { files: 1, fields: 0, parts: 2, fileSize: MAX_BYTES } });
        } catch {
            rejectOperation(inputError('Formulario multipart invalido'));
            return;
        }
        let invalid = false;
        let extractedBuffer = null;
        let detectedMime = 'image/png';

        parserInstance.on('file', (fieldName, fileStream, fileInfo) => {
            detectedMime = fileInfo.mimeType || 'image/png';
            const dataChunks = [];
            fileStream.on('limit', () => { invalid = true; });
            fileStream.on('error', rejectOperation);
            
            fileStream.on('data', (piece) => dataChunks.push(piece));
            fileStream.on('end', () => {
                extractedBuffer = Buffer.concat(dataChunks);
            });
        });

        for (const limit of ['filesLimit', 'fieldsLimit', 'partsLimit']) parserInstance.on(limit, () => { invalid = true; });
        parserInstance.on('close', () => invalid
            ? rejectOperation(inputError('Envia un unico archivo de hasta 4 MiB'))
            : resolveOperation({ extractedBuffer, detectedMime }));
        parserInstance.on('error', () => rejectOperation(inputError('Formulario multipart invalido')));

        const rawPayload = incomingEvent.isBase64Encoded
            ? Buffer.from(incomingEvent.body, 'base64')
            : Buffer.from(incomingEvent.body, 'utf8');

        parserInstance.write(rawPayload);
        parserInstance.end();
    });
};

export const createHandler = (client = s3ClientInstance) => async (lambdaEvent) => {
    
    try {
        const targetBucketName = process.env.S3_BUCKET;
        const targetPrefix = process.env.UPLOAD_PREFIX || 'uploads/';
        if (typeof lambdaEvent.body !== 'string' || !lambdaEvent.body.length) throw inputError('Falta la imagen');
        if (Buffer.byteLength(lambdaEvent.body) > Math.ceil(MAX_BYTES / 3) * 4 + 65536) throw inputError('La solicitud supera el limite', 413);
        
        const headerMap = lambdaEvent.headers || {};
        const mediaTypeHeader = headerMap['content-type'] || headerMap['Content-Type'] || '';

        let activeBuffer;
        let activeMimeType;

        if (mediaTypeHeader.includes('multipart/form-data')) {
            const multipartResult = await extractMultipartData(lambdaEvent);
            activeBuffer = multipartResult.extractedBuffer;
            activeMimeType = multipartResult.detectedMime;
        } else if (mediaTypeHeader.includes('application/json')) {
            const jsonBody = lambdaEvent.isBase64Encoded ? Buffer.from(lambdaEvent.body, 'base64').toString('utf8') : lambdaEvent.body;
            let payload;
            try { payload = JSON.parse(jsonBody); } catch { throw inputError('JSON invalido'); }
            if (typeof payload.imageBase64 !== 'string' || !payload.imageBase64.length || payload.imageBase64.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(payload.imageBase64)) throw inputError('imageBase64 invalido');
            activeBuffer = Buffer.from(payload.imageBase64, 'base64');
            activeMimeType = payload.contentType || 'image/png';
        } else if (allowedTypes[mediaTypeHeader]) {
            activeBuffer = lambdaEvent.isBase64Encoded
                ? Buffer.from(lambdaEvent.body, 'base64')
                : Buffer.from(lambdaEvent.body);
            activeMimeType = mediaTypeHeader || 'image/png';
        } else throw inputError('Tipo de contenido no soportado', 415);

        if (!activeBuffer || activeBuffer.length === 0) {
            throw inputError("El contenido del archivo multimedia se encuentra vacío");
        }
        if (activeBuffer.length > MAX_BYTES) throw inputError('La imagen supera 4 MiB', 413);
        if (!allowedTypes[activeMimeType]) throw inputError('Usa JPG, PNG, GIF o WebP', 415);
        if (detectImageType(activeBuffer) !== activeMimeType) throw inputError('Los bytes no corresponden al tipo de imagen declarado', 415);
        if (!targetBucketName) throw new Error('Falta S3_BUCKET');
        const generatedFileName = `${generateUUID()}.${allowedTypes[activeMimeType]}`;

        await client.send(
            new PutObjectCommand({
                Bucket: targetBucketName,
                Key: `${targetPrefix}${generatedFileName}`,
                Body: activeBuffer,
                ContentType: activeMimeType
            })
        );

        return {
            statusCode: 202,
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ 
                msg: "Archivo cargado con éxito", 
                filename: generatedFileName,
                uploadKey: `${targetPrefix}${generatedFileName}`,
                processedKey: `processed/${generatedFileName.replace(/\.[^.]+$/, '.png')}`
            })
        };
        
    } catch (failureException) {
        console.error("FALLO EN LA EJECUCIÓN:", failureException.message);
        return {
            statusCode: failureException.statusCode || 500,
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ 
                errorDescription: failureException.statusCode ? failureException.message : 'No se pudo guardar la imagen'
            })
        };
    }
};

export const handler = createHandler();
