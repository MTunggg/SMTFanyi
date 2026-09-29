import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { translate } from "@vitalets/google-translate-api";
import { pinyin } from "pinyin-pro";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Increase payload limit for base64 audio/images
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // API Route for translation
  app.post("/api/translate", async (req, res) => {
    try {
      const { text, audio, image, context, direction, confirmedFallback } = req.body;
      const authHeader = req.headers.authorization;
      const customApiKey = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;

      const apiKey = customApiKey;
      
      if (!apiKey) {
        if (audio || image) {
          return res.status(400).json({ error: "Tính năng nhận diện giọng nói và quét hình ảnh yêu cầu Khóa API. Vui lòng nhập khóa cài đặt hoặc chỉ sử dụng tính năng gõ văn bản." });
        }
        
        if (!confirmedFallback) {
          return res.status(428).json({ 
            requireConfirmation: true, 
            message: "Bạn đang không sử dụng API Key, hệ thống sẽ dịch bằng google dịch" 
          });
        }
        
        // Use standard Google Translate fallback
        if (text) {
          let toLang = 'vi';
          let pinyinText = '';
          if (direction === 'vi-zh') {
            toLang = 'zh-CN';
          } else if (direction === 'zh-vi') {
            toLang = 'vi';
          }
          const translateResult = await translate(text, { to: toLang });
          
          if (direction === 'vi-zh') {
            pinyinText = pinyin(translateResult.text);
          }
          
          return res.json({
            original_text: text,
            translation: translateResult.text,
            pinyin: pinyinText
          });
        } else {
          return res.status(400).json({ error: "No input provided." });
        }
      }

      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      const parts: any[] = [];
      
      let basePrompt = "";
      if (context === "casual") {
        basePrompt = "Bạn là một người phiên dịch tiếng Trung và tiếng Việt bản xứ. Nhiệm vụ của bạn là dịch các cuộc hội thoại giao tiếp hàng ngày, sinh hoạt, ăn uống, và trao đổi thông thường. Giọng văn phải vô cùng tự nhiên, đời thường, sử dụng từ ngữ phổ thông, hạn chế dùng từ ngữ quá trang trọng hay máy móc.";
      } else {
        basePrompt = "Bạn là kỹ sư trưởng phiên dịch chuyên ngành sản xuất điện tử công nghiệp. Nhiệm vụ của bạn là dịch chính xác tuyệt đối các chỉ đạo kỹ thuật, lỗi máy móc, thông số cài đặt giữa tiếng Trung và tiếng Việt. Bối cảnh làm việc là dây chuyền dán linh kiện bề mặt SMT và máy kiểm tra quang học tự động AOI và SPI cũng như máy NXT và lò hàn reflow. Bắt buộc sử dụng đúng thuật ngữ chuyên ngành về bo mạch, IC, thiếc hàn, lỗi ngoại quan. Văn phong dứt khoát, xúc tích, báo cáo thẳng vào vấn đề, giữ nguyên các mã linh kiện tiếng Anh, không giải thích dài dòng.";
      }

      let directionInstruction = "";
      if (direction === 'vi-zh') {
        directionInstruction = "Hãy dịch đầu vào sang tiếng Trung Quốc.";
      } else if (direction === 'zh-vi') {
        directionInstruction = "Hãy dịch đầu vào sang tiếng Việt.";
      }

      const systemInstruction = `${basePrompt}
${directionInstruction}
Bắt buộc trả kết quả về dưới dạng JSON thuần túy gồm ba trường:
- "original_text": văn bản gốc (hoặc văn bản được nhận dạng từ âm thanh/hình ảnh).
- "translation": bản dịch.
- "pinyin": phiên âm của bản dịch (chỉ có nếu bản dịch là tiếng Trung, nếu không hãy để trống).
Không được giải thích hay thêm bất kỳ văn bản nào khác.
Nếu tệp âm thanh đính kèm không có tiếng người, chỉ chứa tiếng ồn môi trường, hoặc hoàn toàn trống rỗng, bắt buộc phải trả về chuỗi rỗng cho cả trường văn bản gốc và trường bản dịch. Tuyệt đối không được phép suy diễn, đoán chữ hay tự tạo ra nội dung giả mạo.`;

      if (text) {
        parts.push({ text });
      }
      if (audio) {
        parts.push({
          inlineData: {
            data: audio.data,
            mimeType: audio.mimeType,
          },
        });
        // Hint the model to transcribe if audio is present
        parts.push({ text: "Please transcribe the audio into original_text and then translate it." });
      }
      if (image) {
        parts.push({
          inlineData: {
            data: image.data,
            mimeType: image.mimeType,
          },
        });
      }

      if (parts.length === 0) {
         return res.status(400).json({ error: "No input provided." });
      }

      let response;
      let retries = 3;
      let lastError = null;

      for (let i = 0; i < retries; i++) {
        try {
          response = await ai.models.generateContent({
            model: "gemini-3.6-flash",
            contents: { parts },
            config: {
              systemInstruction,
              responseMimeType: "application/json",
            },
          });
          lastError = null;
          break;
        } catch (error: any) {
          lastError = error;
          const errorMessage = error.message || "";
          const isTransient = error.status === 503 || error.status === 429 || errorMessage.includes("503") || errorMessage.includes("429");
          
          if (isTransient && i < retries - 1) {
            await new Promise(res => setTimeout(res, 1000 * (i + 1)));
            console.log(`Retrying generation due to transient error... Attempt ${i + 2}`);
          } else {
            break;
          }
        }
      }

      if (lastError) {
        throw lastError;
      }

      let resultObj;
      try {
        resultObj = JSON.parse(response?.text || "{}");
      } catch (e) {
        resultObj = { original_text: "", translation: response?.text || "", pinyin: "" };
      }

      res.json(resultObj);
    } catch (error: any) {
      console.error("Translation error:", error);
      let errorMessage = "Failed to translate.";
      
      let statusCode = 500;
      
      try {
        if (error.status === 429 || (error.message && error.message.includes("429"))) {
            statusCode = 429;
        } else if (error.status === 503 || (error.message && error.message.includes("503"))) {
            statusCode = 503;
        }

        if (error.message) {
          const parsed = JSON.parse(error.message);
          if (parsed.error && parsed.error.code) {
              if (parsed.error.code === 429) statusCode = 429;
              if (parsed.error.code === 503) statusCode = 503;
          }
          if (parsed.error && parsed.error.message) {
            errorMessage = parsed.error.message;
          } else {
            errorMessage = error.message;
          }
        }
      } catch (e) {
        errorMessage = error.message || "Failed to translate.";
      }
      
      if (statusCode === 503 && errorMessage === "Failed to translate.") {
        errorMessage = "Hệ thống AI đang bị quá tải (Google Gemini). Vui lòng đợi một lát rồi thử lại hoặc sử dụng Google Dịch.";
      }
      
      res.status(statusCode).json({ error: errorMessage });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
