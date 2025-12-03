const express = require("express");
const multer = require("multer");
const { Sequelize, DataTypes } = require("sequelize");
const path = require("path");
const fs = require("fs");

const app = express();

const sequelize = new Sequelize({
    dialect: "sqlite",
    storage: "database.sqlite",
    logging: false
});

const File = sequelize.define("File", {
    filename: {
        type: DataTypes.STRING,
        allowNull: false
    },
    originalName: {
        type: DataTypes.STRING,
        allowNull: false
    },
    mimetype: {
        type: DataTypes.STRING
    },
    size: {
        type: DataTypes.INTEGER
    },
    uploadDate: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
});

const storageConfig = multer.diskStorage({
    destination: (req, file, cb) =>{
        cb(null, "uploads");
    },
    filename:(req, file, cb) =>{
        cb(null, file.originalname);
    }
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

const upload = multer({ 
    storage: storageConfig, 
    limits: { fileSize: 100 * 1024 * 1024 } 
}).single("filedata");


app.post("/upload", function (req, res, next) {
    upload(req, res, async function (err) {
        if (err) {
            console.error("Upload error:", err);
            return res.status(500).send("Error uploading file");
        }
        
        let filedata = req.file;
        console.log("Uploaded file:", filedata);
        
        if (!filedata) {
            return res.status(400).send("Error loading file: Invalid file type");
        }
        
        try {
            const savedFile = await File.create({
                filename: filedata.filename,
                originalName: filedata.originalname,
                mimetype: filedata.mimetype,
                size: filedata.size
            });
            
            console.log("Файл сохранен в БД:", savedFile.toJSON());
            res.send("Файл сохранен!");
        } catch (dbError) {
            console.error("Ошибка:", dbError);
            res.status(500).send("Ошибка сохранения");
        }
    });
});

app.get("/files", async (req, res) => {
    try {
        const files = await File.findAll({
            order: [['uploadDate', 'DESC']]
        });
        res.json(files);
    } catch (error) {
        console.error("Ошибка:", error);
        res.status(500).json({ error: "Ошибка" });
    }
});

app.get("/download/:id", async (req, res) => {
    try {
        const file = await File.findByPk(req.params.id);
        if (!file) {
            return res.status(404).send("Файл не найден");
        }
        
        const filePath = path.join(__dirname, "uploads", file.filename);
        res.download(filePath, file.originalName);
    } catch (error) {
        console.error("Ошибка скачивания:", error);
        res.status(500).send("Ошибка скачивания файла");
    }
});

app.delete("/file/:id", async (req, res) => {
    try {
        const file = await File.findByPk(req.params.id);
        if (!file) {
            return res.status(404).json({ error: "Файл не найден" });
        }
        
        const filePath = path.join(__dirname, "uploads", file.filename);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        
        await file.destroy();
        
        res.json({ message: "Файл удален" });
    } catch (error) {
        console.error("Ошибка удаления:", error);
        res.status(500).json({ error: "Ошибка удаления файла" });
    }
});

sequelize.sync({ force: false })
    .then(() => {
        console.log("БД синхронизирована");
        app.listen(3000, () => {
            console.log("Server start http://localhost:3000");
        });
    })
    .catch(error => {
        console.error("Ошибка синхронизации БД:", error);
    });