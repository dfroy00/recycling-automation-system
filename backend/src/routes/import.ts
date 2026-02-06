// backend/src/routes/import.ts
import { Router, Request, Response } from 'express'
import multer from 'multer'
import path from 'path'
import { authenticate, authorize } from '../middleware/auth'
import { importTrips, importItems } from '../services/import.service'

const router = Router()

// multer 設定
const storage = multer.diskStorage({
  destination: path.join(__dirname, '../../uploads'),
  filename: (_req, file, cb) => {
    const timestamp = Date.now()
    const ext = path.extname(file.originalname)
    cb(null, `${timestamp}-${file.fieldname}${ext}`)
  },
})

const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    if (ext === '.xlsx' || ext === '.xls') {
      cb(null, true)
    } else {
      cb(new Error('僅支援 .xlsx 或 .xls 格式'))
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
})

// POST /api/import/trips - 匯入車趟資料
router.post(
  '/trips',
  authenticate,
  authorize('system_admin', 'site_admin'),
  upload.single('file'),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        res.status(400).json({ message: '請上傳 Excel 檔案' })
        return
      }

      const siteId = req.body.siteId || req.user?.siteId
      if (!siteId) {
        res.status(400).json({ message: '請指定站點 siteId' })
        return
      }

      const result = await importTrips(req.file.path, siteId)
      res.json(result)
    } catch (error: any) {
      console.error('匯入車趟失敗:', error)
      res.status(500).json({ message: '匯入失敗', error: error.message })
    }
  }
)

// POST /api/import/items - 匯入品項資料
router.post(
  '/items',
  authenticate,
  authorize('system_admin', 'site_admin'),
  upload.single('file'),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        res.status(400).json({ message: '請上傳 Excel 檔案' })
        return
      }

      const siteId = req.body.siteId || req.user?.siteId
      if (!siteId) {
        res.status(400).json({ message: '請指定站點 siteId' })
        return
      }

      const result = await importItems(req.file.path, siteId)
      res.json(result)
    } catch (error: any) {
      console.error('匯入品項失敗:', error)
      res.status(500).json({ message: '匯入失敗', error: error.message })
    }
  }
)

export default router
