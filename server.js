const FormData = require('form-data');
const express = require('express');
const multer = require('multer');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = 3001;

const OCR_SPACE_API_KEY = process.env.OCR_SPACE_API_KEY;
if (!OCR_SPACE_API_KEY) {
  console.error('❌ Error: OCR_SPACE_API_KEY is not set in .env');
  process.exit(1);
}

app.use(cors());
app.use(express.json());

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

app.post('/api/upload', upload.single('imageFile'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Không tìm thấy file ảnh.' });
  }

  try {
    const form = new FormData();
    form.append('file', req.file.buffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype,
    });
    form.append('language', 'eng');
    form.append('isOverlayRequired', 'false');

    console.log('📤 Đang gửi yêu cầu đến OCR.space API...');

    const response = await axios.post('https://api.ocr.space/parse/image', form, {
      headers: {
        apikey: OCR_SPACE_API_KEY,
        ...form.getHeaders(),
      },
      timeout: 30000,
    });

    console.log('📥 Đã nhận phản hồi.');

    const ocrResult = response.data;
    if (ocrResult.IsErroredOnProcessing) {
      return res.status(500).json({
        error: Array.isArray(ocrResult.ErrorMessage)
          ? ocrResult.ErrorMessage.join(', ')
          : ocrResult.ErrorMessage,
      });
    }

    const extractedText =
      ocrResult.ParsedResults && ocrResult.ParsedResults.length > 0
        ? ocrResult.ParsedResults[0].ParsedText
        : 'Không nhận dạng được văn bản.';

    res.json({ text: extractedText });
  } catch (error) {
    console.error(
      '❌ Lỗi khi gọi OCR.space API:',
      error.response ? error.response.data : error.message
    );
    res.status(500).json({ error: 'Đã xảy ra lỗi phía server.' });
  }
});

app.listen(port, () => {
  console.log(`✅ Backend server đang chạy tại http://localhost:${port}`);
});