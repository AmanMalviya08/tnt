const { S3Client, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const multer = require("multer");
const multerS3 = require("multer-s3");

const s3Client = new S3Client({
  region: process.env.LINODE_OBJECT_STORAGE_REGION || "in-maa-1",
  endpoint:
    process.env.LINODE_OBJECT_STORAGE_ENDPOINT ||
    "https://in-maa-1.linodeobjects.com",
  forcePathStyle: false,
  credentials: {
    accessKeyId: process.env.LINODE_OBJECT_STORAGE_ACCESS_KEY_ID,
    secretAccessKey: process.env.LINODE_OBJECT_STORAGE_SECRET_ACCESS_KEY,
  },
});

const multerFilter = (req, file, cb) => {
  cb(null, true);
};

const upload = multer({
  storage: multerS3({
    s3: s3Client,
    acl: "public-read",
    bucket: process.env.LINODE_OBJECT_BUCKET || "leadkart",
    contentType: (req, file, cb) => cb(null, file.mimetype),
    metadata: (req, file, cb) => cb(null, { fieldName: file.fieldname }),
    key: (req, file, cb) => {
      let folderPath = "TourTravels/OTHERS/";

      if (file.mimetype.startsWith("image")) {
        folderPath = "TourTravels/IMAGE/";
      } else if (file.mimetype.startsWith("video")) {
        folderPath = "TourTravels/VIDEO/";
      } else if (file.mimetype === "application/pdf") {
        folderPath = "TourTravels/PDF/";
      }

      const fileName = `${Date.now()}_${file.originalname}`;
      cb(null, `${folderPath}${fileName}`);
    },
  }),
  fileFilter: multerFilter,
});

const uploadSingle = (fieldName) => upload.single(fieldName);
const uploadArray = (fieldName, maxCount = 5) =>
  upload.array(fieldName, maxCount);
const uploadFields = (fields = []) => upload.fields(fields);
const uploadAny = () => upload.any();

const deleteFileFromObjectStorage = async (url) => {
  const urlObject = new URL(url);
  const key = urlObject.pathname.substring(1);

  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: process.env.LINODE_OBJECT_BUCKET || "leadkart",
      Key: key,
    }),
  );
};

module.exports = {
  s3Client,
  upload,
  uploadSingle,
  uploadArray,
  uploadFields,
  uploadAny,
  deleteFileFromObjectStorage,
};
