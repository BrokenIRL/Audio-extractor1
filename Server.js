const express = require('express');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');

const app = express();

// Ensure the uploads directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// Set up file uploading configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage: storage });

// Serve frontend static files from a 'public' directory
app.use(express.static('public'));

// Audio extraction endpoint
app.post('/api/extract', upload.single('video'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Please upload a video file.' });
    }

    const inputPath = req.file.path;
    const outputFilename = `${req.file.filename}.mp3`;
    const outputPath = path.join(__dirname, 'uploads', outputFilename);

    // Run FFmpeg conversion
    ffmpeg(inputPath)
        .toFormat('mp3')
        .audioBitrate(192) // High-quality audio
        .on('end', () => {
            // Send the file to user, then delete local copies to clear space
            res.download(outputPath, 'extracted_audio.mp3', (err) => {
                try {
                    fs.unlinkSync(inputPath);
                    fs.unlinkSync(outputPath);
                } catch (cleanupError) {
                    console.error('Error cleaning up files:', cleanupError);
                }
            });
        })
        .on('error', (err) => {
            console.error('FFmpeg error:', err);
            res.status(500).json({ error: 'Audio extraction failed.' });
            
            // Clean up original video on failure
            if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
        })
        .save(outputPath);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server launched on http://localhost:${PORT}`));
