import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

// Provided AWS Credentials
const REGION = "eu-north-1";
const BUCKET_NAME = "babelgallery";
const KEY_PREFIX = "gallicagram_mcp/";

const s3Client = new S3Client({
    region: REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID_GALLICAGRAM,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY_GALLICAGRAM
    }
});

/**
 * Upload a buffer to S3 and return the public URL
 * @param {Buffer} buffer - Image data
 * @param {string} filename - Filename (without prefix)
 * @param {string} contentType - MIME type
 * @returns {Promise<string>} - The S3 URL
 */
export async function uploadToS3(buffer, filename, contentType = "image/png") {
    const key = `${KEY_PREFIX}${filename}`;

    await s3Client.send(
        new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
            Body: buffer,
            ContentType: contentType,
            // ACL: "public-read" // Note: S3 buckets might have block public access enabled, 
            // but the user's URL pattern https://babelgallery.s3.eu-north-1.amazonaws.com/gallicagram_mcp/ 
            // suggests direct access is intended.
        })
    );

    return `https://${BUCKET_NAME}.s3.${REGION}.amazonaws.com/${key}`;
}
