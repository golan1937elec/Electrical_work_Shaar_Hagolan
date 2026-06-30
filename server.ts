import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

const app = express();
const PORT = 3000;

app.use(express.json());

// API route to fetch Erco product page details
app.post("/api/fetch-erco", async (req: any, res: any) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "נא לספק כתובת קישור תקינה" });
    }
    if (!url.includes("erco.co.il")) {
      return res.status(400).json({ error: "הקישור חייב להיות מאתר ארכה (erco.co.il)" });
    }

    console.log(`Fetching Erco URL: ${url}`);
    
    let response;
    try {
      response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
          "Accept-Language": "he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7",
          "Cache-Control": "no-cache",
          "Pragma": "no-cache"
        },
        signal: AbortSignal.timeout(12000) // 12 seconds timeout
      });
    } catch (fetchErr: any) {
      console.error("Fetch to Erco failed:", fetchErr);
      if (fetchErr.name === "TimeoutError" || fetchErr.message?.includes("timeout")) {
        return res.status(504).json({ 
          error: "זמן החיבור לאתר ארכה פג (Timeout). ייתכן ששרת האתר חוסם חיבורים אוטומטיים או עמוס כרגע." 
        });
      }
      return res.status(500).json({ 
        error: `שגיאת חיבור לאתר ארכה: ${fetchErr.message || "לא ניתן ליצור קשר עם השרת"}` 
      });
    }

    if (!response.ok) {
      return res.status(400).json({ 
        error: `אתר ארכה החזיר קוד שגיאה: ${response.status}. ייתכן שהדף אינו קיים או שהאתר חוסם את הבקשה.` 
      });
    }

    const html = await response.text();

    // 1. Try to extract SKU (מק"ט)
    let sku = "";
    const urlSkuMatch = url.match(/\/(\d{6,8})(?:-|\/|\.)/);
    if (urlSkuMatch) {
      sku = urlSkuMatch[1];
    }

    if (!sku) {
      const skuMatch = html.match(/itemprop="sku"[^>]*>([^<]+)</i) || 
                       html.match(/"sku"\s*:\s*"(\d+)"/i) || 
                       html.match(/מק"ט ארכה:?\s*<\/strong>\s*<span>([^<]+)</i) ||
                       html.match(/מק"ט:?\s*<\/strong>\s*<span>([^<]+)</i) ||
                       html.match(/sku[^>]*>([^<]+)</i);
      if (skuMatch) {
        sku = skuMatch[1].trim();
      }
    }

    // 2. Try to extract Product Name (שם המוצר)
    let name = "";
    
    // Better name selector if present: <h1 class="page-title">...
    const h1Match = html.match(/<h1[^>]*class="page-title"[^>]*>(?:<span[^>]*>)?([^<]+)(?:<\/span>)?<\/h1>/i) ||
                    html.match(/<h1[^>]*itemprop="name"[^>]*>([^<]+)<\/h1>/i) ||
                    html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    if (h1Match) {
      name = h1Match[1].replace(/<\/?[^>]+(>|$)/g, "").trim();
    } else {
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (titleMatch) {
        name = titleMatch[1].replace(/\s*\|\s*ארכה.*/, "").replace(/\s*\|\s*Erco.*/, "").trim();
      }
    }

    // 3. Try to extract Price (מחיר)
    let price = "";
    const ogPriceMatch = html.match(/<meta\s+property="og:price:amount"\s+content="([^"]+)"/i) ||
                         html.match(/<meta\s+name="price"\s+content="([^"]+)"/i) ||
                         html.match(/"price"\s*:\s*"?(\d+(?:\.\d+)?)"?/i);
    if (ogPriceMatch) {
      price = ogPriceMatch[1].trim();
    } else {
      const priceClassMatch = html.match(/class="price-excluding-tax"[^>]*>[\s\S]*?class="price"[^>]*>([^<]+)</i) ||
                              html.match(/data-price-amount="([^"]+)"/i) ||
                              html.match(/class="price"[^>]*>₪?([^<]+)</i);
      if (priceClassMatch) {
        price = priceClassMatch[1].replace(/[^\d.]/g, "").trim();
      }
    }

    let numericPrice: number | undefined;
    if (price) {
      numericPrice = parseFloat(price.replace(/[^\d.]/g, ""));
    }

    // 4. Try to extract Brand (מותג)
    let brand = "";
    const brandMatch = html.match(/"brand"\s*:\s*"([^"]+)"/i) ||
                       html.match(/מותג:?\s*<\/strong>\s*<span>([^<]+)</i) ||
                       html.match(/יצרן:?\s*<\/strong>\s*<span>([^<]+)</i);
    if (brandMatch) {
      brand = brandMatch[1].trim();
    } else if (name) {
      const lowerName = name.toLowerCase();
      if (lowerName.includes("hager")) brand = "Hager";
      else if (lowerName.includes("schneider")) brand = "Schneider";
      else if (lowerName.includes("nisko")) brand = "Nisko";
      else if (lowerName.includes("gewiss")) brand = "Gewiss";
      else if (lowerName.includes("abb")) brand = "ABB";
      else if (lowerName.includes("legrand")) brand = "Legrand";
      else if (lowerName.includes("viko")) brand = "Viko";
      else if (lowerName.includes("ארקו") || lowerName.includes("arco")) brand = "ארקו";
      else if (lowerName.includes("יוניק") || lowerName.includes("uniq")) brand = "Uniq";
    }

    // Check if we parsed absolutely nothing - indicating we likely got blocked or have an invalid product page
    if (!name && !sku && !price) {
      if (html.toLowerCase().includes("cloudflare") || html.toLowerCase().includes("captcha") || html.toLowerCase().includes("sucuri") || html.toLowerCase().includes("security") || html.toLowerCase().includes("verify you are human") || html.toLowerCase().includes("challenge")) {
        return res.status(403).json({
          error: "אתר ארכה חסם את השליפה האוטומטית הזמנית (הגנת בוטים/WAF). נא להזין את פרטי המוצר ומחיר העלות ידנית."
        });
      }
      return res.status(400).json({
        error: "לא הצלחנו לזהות את פרטי המוצר בדף זה. ודא שהקישור מוביל לדף מוצר תקין בארכה."
      });
    }

    return res.json({
      success: true,
      sku: sku || undefined,
      name: name || undefined,
      costPrice: numericPrice || undefined,
      brand: brand || undefined
    });

  } catch (error: any) {
    console.error("Error fetching Erco page:", error);
    return res.status(500).json({ error: `שגיאה בשליפת הנתונים מאתר ארכה: ${error.message}` });
  }
});

// Serve Vite client app
async function startServer() {
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
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
