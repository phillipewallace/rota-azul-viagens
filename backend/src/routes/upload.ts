
import { Router, Request, Response, RequestHandler } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename while preserving extension
    const uniqueName = `${uuidv4()}-${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept all file types
    cb(null, true);
  }
});

// Upload single file
const uploadHandler: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'Nenhum arquivo enviado' });
      return;
    }

    console.log('📁 File uploaded:', req.file.filename);

    const fileInfo = {
      id: uuidv4(),
      originalName: req.file.originalname,
      filename: req.file.filename,
      size: req.file.size,
      mimetype: req.file.mimetype,
      url: `/api/files/${req.file.filename}`
    };

    res.json(fileInfo);
  } catch (error) {
    console.error('❌ Upload error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

router.post('/', upload.single('file'), uploadHandler);

// Serve uploaded files
const getFileHandler: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { filename } = req.params;
    const filePath = path.join(uploadsDir, filename);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'Arquivo não encontrado' });
      return;
    }

    console.log('📁 Serving file:', filename);
    res.sendFile(filePath);
  } catch (error) {
    console.error('❌ Error serving file:', error);
    res.status(500).json({ error: 'Erro ao acessar arquivo' });
  }
};

router.get('/files/:filename', getFileHandler);

// Delete file
const deleteFileHandler: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { filename } = req.params;
    const filePath = path.join(uploadsDir, filename);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log('🗑️ File deleted:', filename);
      res.json({ message: 'Arquivo excluído com sucesso' });
    } else {
      res.status(404).json({ error: 'Arquivo não encontrado' });
    }
  } catch (error) {
    console.error('❌ Delete error:', error);
    res.status(500).json({ error: 'Erro ao excluir arquivo' });
  }
};

router.delete('/files/:filename', deleteFileHandler);

export default router;
