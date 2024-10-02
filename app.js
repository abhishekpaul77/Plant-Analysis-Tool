require("dotenv").config();
const express = require("express");
const multer = require("multer");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const fsPromises = fs.promises;
const path = require("path");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const cors = require('cors');


const app = express();
const port = process.env.PORT || 5000;
app.use(cors());

//configure multer
const upload = multer({ dest: "upload/" });
app.use(express.json({ limit: "10mb" }));

//initialize Google Generative AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
app.use(express.static("public"));
app.get('/test', (req, res) => {
  console.log('Test route hit');
  res.json({ message: 'Backend is working' });
});

//routes
//analyze
// app.post("/analyze", upload.single("image"), async (req, res) => {
//   try {
//     if (!req.file) {
//       return res.status(400).json({ error: "No image file uploaded" });
//     }

//     const imagePath = req.file.path;
//     const imageData = await fsPromises.readFile(imagePath, {
//       encoding: "base64",
//     });

//     // Use the Gemini model to analyze the image
//     const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
//     const result = await model.generateContent([
//       "Analyze this plant image and provide detailed analysis of its species, health, and care recommendations, its characteristics, care instructions, and any interesting facts. Please provide the response in plain text without using any markdown formatting.",
//       {
//         inlineData: {
//           mimeType: req.file.mimetype,
//           data: imageData,
//         },
//       },
//     ]);

//     const plantInfo = result.response.text();
//     console.log(plantInfo);

//     // Clean up: delete the uploaded file
//     await fsPromises.unlink(imagePath);

//     // Respond with the analysis result and the image data
//     res.json({
//       result: plantInfo,
//       image: `data:${req.file.mimetype};base64,${imageData}`,
//     });
//   } catch (error) {
//     console.error("Error analyzing image:", error);
//     res
//       .status(500)
//       .json({ error: "An error occurred while analyzing the image" });
//   }
// });
app.post("/analyze", upload.single("image"), async (req, res) => {
  try {
    console.log("Received analyze request");
    if (!req.file) {
      console.log("No image file uploaded");
      return res.status(400).json({ error: "No image file uploaded" });
    }
    console.log("Image file received:", req.file.originalname);
    const imagePath = req.file.path;
    const imageData = await fsPromises.readFile(imagePath, {
      encoding: "base64",
    });
    console.log("Image data read successfully");
    
    // Use the Gemini model to analyze the image
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    console.log("Sending request to Gemini model...");
    const result = await model.generateContent([
      "Analyze this plant image and provide detailed analysis of its species, health, and care recommendations, its characteristics, care instructions, and any interesting facts. Please provide the response in plain text without using any markdown formatting.",
      {
        inlineData: {
          mimeType: req.file.mimetype,
          data: imageData,
        },
      },
    ]);
    console.log("Received response from Gemini model");
    const plantInfo = result.response.text();
    console.log("Plant info:", plantInfo);
    
    // Clean up: delete the uploaded file
    await fsPromises.unlink(imagePath);
    console.log("Temporary image file deleted");
    
    // Respond with the analysis result and the image data
    console.log("Sending response to frontend...");
    res.json({
      result: plantInfo,
      image: `data:${req.file.mimetype};base64,${imageData}`,
    });
    console.log("Response sent successfully");
  } catch (error) {
    console.error("Error analyzing image:", error);
    res
      .status(500)
      .json({ error: "An error occurred while analyzing the image" });
  }
});
//download pdf
app.post("/download", express.json(), async (req, res) => {
  const { result, image } = req.body;
  try {
    //Ensure the reports directory exists
    const reportsDir = path.join(__dirname, "reports");
    await fsPromises.mkdir(reportsDir, { recursive: true });
    //generate pdf
    const filename = `plant_analysis_report_${Date.now()}.pdf`;
    const filePath = path.join(reportsDir, filename);
    const writeStream = fs.createWriteStream(filePath);
    const doc = new PDFDocument();
    doc.pipe(writeStream);
    // Add content to the PDF
    doc.fontSize(24).text("Plant Analysis Report", {
      align: "center",
    });
    doc.moveDown();
    doc.fontSize(24).text(`Date: ${new Date().toLocaleDateString()}`);
    doc.moveDown();
    doc.fontSize(14).text(result, { align: "left" });
    //insert image to the pdf
    if (image) {
      const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");
      doc.moveDown();
      doc.image(buffer, {
        fit: [500, 300],
        align: "center",
        valign: "center",
      });
    }
    doc.end();
    //wait for the pdf to be created
    await new Promise((resolve, reject) => {
      writeStream.on("finish", resolve);
      writeStream.on("error", reject);
    });
    res.download(filePath, (err) => {
      if (err) {
        res.status(500).json({ error: "Error downloading the PDF report" });
      }
      fsPromises.unlink(filePath);
    });
  } catch (error) {
    console.error("Error generating PDF report:", error);
    res
      .status(500)
      .json({ error: "An error occurred while generating the PDF report" });
  }
});
//start the server
app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});
