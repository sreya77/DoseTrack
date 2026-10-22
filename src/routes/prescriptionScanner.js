const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const { scanPrescription, PRESCRIPTION_PROMPT } = require('../services/prescriptionVisionService');

router.use(requireAuth);

/**
 * POST /api/medications/scan-prescription
 * Accepts a captured or uploaded prescription image (Base64) or sampleId
 * Returns structured medication data extracted by AI Vision.
 */
router.post('/scan-prescription', async (req, res, next) => {
  try {
    const { imageBase64, mimeType = 'image/jpeg', sampleId } = req.body;

    if (!imageBase64 && !sampleId) {
      return res.status(400).json({
        error: 'No prescription image provided. Please capture a photo or choose an image file.'
      });
    }

    if (imageBase64) {
      // Validate payload size (approx 15MB max)
      const approxBytes = (imageBase64.length * 3) / 4;
      if (approxBytes > 15 * 1024 * 1024) {
        return res.status(413).json({
          error: 'Image is too large (maximum size is 15MB). Please choose a smaller photo or compress it.'
        });
      }

      // Basic MIME type validation
      const validMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
      const normalizedMime = mimeType.toLowerCase();
      if (!validMimes.some(m => normalizedMime.includes(m.split('/')[1]))) {
        return res.status(415).json({
          error: 'Unsupported image format. Please upload a JPEG, PNG, or WEBP photo of the prescription.'
        });
      }
    }

    const extraction = await scanPrescription({ imageBase64, mimeType, sampleId });

    if (!extraction.medications || !extraction.medications.length) {
      return res.status(422).json({
        error: 'No legible medications detected in this image. Please check lighting, focus, or enter details manually.',
        medications: []
      });
    }

    res.json({
      success: true,
      source: extraction.source,
      medications: extraction.medications
    });
  } catch (err) {
    console.error('[PrescriptionScan] Error:', err);
    res.status(500).json({
      error: err.message || 'Failed to analyze prescription image. Please try again or fill fields manually.'
    });
  }
});

/**
 * GET /api/medications/scan-prompt
 * Informational endpoint to inspect the Vision Prompt Template
 */
router.get('/scan-prompt', (req, res) => {
  res.json({
    prompt: PRESCRIPTION_PROMPT,
    supportedProviders: ['Google Gemini 1.5/2.0 Flash Vision', 'OpenAI GPT-4o Vision', 'Offline Intelligent Heuristic OCR']
  });
});

module.exports = router;
