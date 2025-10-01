const fs = require('fs');
const path = require('path');
const yauzl = require('yauzl');
const { v4: uuidv4 } = require('uuid');

class ImageExtractor {
  constructor() {
    this.uploadsDir = path.join(__dirname, 'uploads');
    this.imagesDir = path.join(this.uploadsDir, 'images');
    
    // Ensure directories exist
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
    if (!fs.existsSync(this.imagesDir)) {
      fs.mkdirSync(this.imagesDir, { recursive: true });
    }
  }

  async extractImagesFromExcel(excelFilePath) {
    console.log('🖼️ Starting image extraction from Excel file...');
    
    return new Promise((resolve, reject) => {
      const extractedImages = [];
      
      yauzl.open(excelFilePath, { lazyEntries: true }, (err, zipfile) => {
        if (err) {
          console.error('❌ Error opening Excel file as ZIP:', err);
          return reject(err);
        }

        console.log('📦 Excel file opened as ZIP archive');
        
        zipfile.readEntry();
        
        zipfile.on('entry', (entry) => {
          // Look for images in the xl/media folder
          if (entry.fileName.startsWith('xl/media/') && this.isImageFile(entry.fileName)) {
            console.log('🖼️ Found image:', entry.fileName);
            
            zipfile.openReadStream(entry, (err, readStream) => {
              if (err) {
                console.error('❌ Error reading image stream:', err);
                zipfile.readEntry();
                return;
              }

              // Generate unique filename
              const originalName = path.basename(entry.fileName);
              const extension = path.extname(originalName).toLowerCase();
              const uniqueName = `${uuidv4()}${extension}`;
              const outputPath = path.join(this.imagesDir, uniqueName);
              
              // Create write stream
              const writeStream = fs.createWriteStream(outputPath);
              
              readStream.pipe(writeStream);
              
              writeStream.on('close', () => {
                console.log('✅ Extracted image:', uniqueName);
                extractedImages.push({
                  originalName: originalName,
                  fileName: uniqueName,
                  filePath: outputPath,
                  relativePath: `uploads/images/${uniqueName}`,
                  webPath: `/uploads/images/${uniqueName}`
                });
                zipfile.readEntry();
              });
              
              writeStream.on('error', (err) => {
                console.error('❌ Error writing image file:', err);
                zipfile.readEntry();
              });
            });
          } else {
            zipfile.readEntry();
          }
        });
        
        zipfile.on('end', () => {
          console.log(`🎉 Image extraction completed. Found ${extractedImages.length} images.`);
          resolve(extractedImages);
        });
        
        zipfile.on('error', (err) => {
          console.error('❌ ZIP file error:', err);
          reject(err);
        });
      });
    });
  }

  isImageFile(fileName) {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff', '.svg'];
    const extension = path.extname(fileName).toLowerCase();
    return imageExtensions.includes(extension);
  }

  // Map images to Excel rows based on their position/order
  mapImagesToRows(extractedImages, totalRows) {
    console.log('🔗 Mapping images to Excel rows...');
    
    // Sort images by the numeric part of their filename (image1.jpg, image2.jpg, etc.)
    const sortedImages = extractedImages.sort((a, b) => {
      const getImageNumber = (name) => {
        const match = name.match(/image(\d+)\./);
        return match ? parseInt(match[1]) : 0;
      };
      return getImageNumber(a.originalName) - getImageNumber(b.originalName);
    });
    
    const imageMap = {};
    let assignedImageCount = 0;
    
    // Simple sequential mapping: assign images in order to available rows
    // image1 -> row 1, image2 -> row 2, etc., but only up to totalRows
    sortedImages.forEach((image) => {
      const match = image.originalName.match(/image(\d+)\./);
      if (match) {
        const imageNumber = parseInt(match[1]);
        
        // Only map images that have corresponding rows
        if (imageNumber > 0 && imageNumber <= totalRows) {
          imageMap[imageNumber] = image.webPath;
          assignedImageCount++;
          console.log(`🔗 Mapped ${image.fileName} (image${imageNumber}) to row ${imageNumber}`);
        } else {
          console.log(`⚠️ Skipping ${image.fileName} (image${imageNumber}) - exceeds total rows (${totalRows})`);
        }
      } else {
        console.log(`⚠️ Could not extract number from ${image.originalName}`);
      }
    });
    
    console.log(`📊 Successfully mapped ${assignedImageCount} images to rows (${extractedImages.length - assignedImageCount} images skipped)`);
    return imageMap;
  }

  // Alternative: try to match images based on material names
  mapImagesByMaterialName(extractedImages, materials) {
    console.log('🔗 Mapping images by material names...');
    
    const imageMap = {};
    
    materials.forEach((material, index) => {
      if (!material.material) return;
      
      // Clean material name for matching
      const cleanMaterialName = material.material
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .substring(0, 10);
      
      // Find image with similar name
      const matchingImage = extractedImages.find(image => {
        const cleanImageName = image.originalName
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '')
          .substring(0, 10);
        
        return cleanImageName.includes(cleanMaterialName) || 
               cleanMaterialName.includes(cleanImageName);
      });
      
      if (matchingImage) {
        imageMap[index] = matchingImage.webPath;
        console.log(`🔗 Matched ${matchingImage.fileName} to "${material.material}"`);
      }
    });
    
    console.log(`📊 Matched ${Object.keys(imageMap).length} images by name`);
    return imageMap;
  }

  // Clean up old extracted images (optional)
  cleanupOldImages(olderThanHours = 24) {
    const cutoffTime = Date.now() - (olderThanHours * 60 * 60 * 1000);
    
    try {
      const files = fs.readdirSync(this.imagesDir);
      let deletedCount = 0;
      
      files.forEach(file => {
        const filePath = path.join(this.imagesDir, file);
        const stats = fs.statSync(filePath);
        
        if (stats.mtime.getTime() < cutoffTime) {
          fs.unlinkSync(filePath);
          deletedCount++;
        }
      });
      
      if (deletedCount > 0) {
        console.log(`🧹 Cleaned up ${deletedCount} old image files`);
      }
    } catch (error) {
      console.error('❌ Error cleaning up old images:', error);
    }
  }
}

module.exports = ImageExtractor;
