const express = require('express');
const multer = require('multer');
const cors = require('cors');
require('dotenv').config(); // Đảm bảo dotenv được gọi đầu tiên

// 1. Import thư viện của AWS Textract
const { TextractClient, DetectDocumentTextCommand } = require("@aws-sdk/client-textract");

const app = express();
const port = 3001;

// 2. Kiểm tra các biến môi trường cần thiết cho AWS
if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY || !process.env.AWS_REGION) {
  console.error('❌ Lỗi: Vui lòng cung cấp đủ AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, và AWS_REGION trong file .env');
  process.exit(1);
}

// 3. Khởi tạo client cho AWS Textract với thông tin xác thực
const textractClient = new TextractClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

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
    console.log('📤 Đang gửi yêu cầu đến AWS Textract API...');

    // 4. Tạo command để gửi đến Textract
    const command = new DetectDocumentTextCommand({
      Document: {
        Bytes: req.file.buffer, // Gửi nội dung file ảnh dưới dạng buffer
      },
    });

    // Gửi command và chờ kết quả
    const response = await textractClient.send(command);
    console.log('📥 Đã nhận phản hồi.');

    // 5. Xử lý kết quả trả về từ Textract
    // Textract trả về một danh sách các "Blocks". Chúng ta cần lọc ra các block có loại là "LINE"
    // và nối chúng lại để có được toàn bộ văn bản.
    const lines = response.Blocks.filter(block => block.BlockType === 'LINE');
    const extractedText = lines.map(line => line.Text).join('\n');

    if (!extractedText) {
        return res.json({ text: 'Không nhận dạng được văn bản.' });
    }

    res.json({ text: extractedText.trim() });

  } catch (error) {
    console.error('❌ Lỗi khi gọi AWS Textract API:', error);
    res.status(500).json({ error: 'Đã xảy ra lỗi phía server khi xử lý ảnh.' });
  }
});

app.listen(port, () => {
  console.log(`✅ Backend server đang chạy tại http://localhost:${port}`);
});