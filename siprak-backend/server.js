const express = require('express');
const cors = require('cors');
const multer = require('multer');
const Tesseract = require('tesseract.js');
const { PrismaClient } = require('@prisma/client');

const app = express();
const prisma = new PrismaClient();
const upload = multer({ dest: 'uploads/' }); // Temporary upload path for OCR

app.use(cors());
app.use(express.json());

// Matriks Waktu Universitas Gunadarma Hardcoded
const MATRIKS_GUNADARMA = {
    1: { start: "07:30", end: "08:30", desc: "Sesi Kuliah Pagi Batas Awal" },
    2: { start: "08:30", end: "09:30", desc: "Sesi Kuliah Pagi" },
    3: { start: "09:30", end: "10:30", desc: "Sesi Kuliah Pagi Batas Akhir" },
    4: { start: "10:30", end: "11:30", desc: "Sesi Kuliah Siang Batas Awal" },
    5: { start: "11:30", end: "12:30", desc: "Sesi Kuliah Siang (Potensi Ishoma)" },
    6: { start: "12:30", end: "13:30", desc: "Sesi Kuliah Siang" },
    7: { start: "13:30", end: "14:30", desc: "Sesi Kuliah Sore Batas Awal" },
    8: { start: "14:30", end: "15:30", desc: "Sesi Kuliah Sore" },
    9: { start: "15:30", end: "16:30", desc: "Sesi Kuliah Sore Batas Akhir" },
    10: { start: "16:30", end: "17:30", desc: "Sesi Kuliah Malam Batas Awal" },
    11: { start: "17:30", end: "18:30", desc: "Sesi Kuliah Malam" },
    12: { start: "18:30", end: "19:30", desc: "Sesi Kuliah Malam (Ishoma)" },
    13: { start: "19:30", end: "20:30", desc: "Sesi Kuliah Malam Akhir" },
    14: { start: "20:30", end: "21:30", desc: "Sesi Kuliah Malam Maksimal" }
};

// Logika Parsing String KRS sesuai PRD
function dapatkanRentangWaktu(stringKRS) {
    const pecahanJam = stringKRS.split('/');
    const jamMulaiIndeks = parseInt(pecahanJam[0]);
    const jamSelesaiIndeks = parseInt(pecahanJam[pecahanJam.length - 1]);
    
    return {
        jamMulaiIndeks,
        jamSelesaiIndeks,
        waktuMulai: MATRIKS_GUNADARMA[jamMulaiIndeks]?.start || "00:00",
        waktuSelesai: MATRIKS_GUNADARMA[jamSelesaiIndeks]?.end || "00:00"
    };
}

// =================== PERSONIL ENDPOINTS ===================

// GET all personil with details (Mapped to camelCase for frontend)
app.get('/api/personil', async (req, res) => {
    try {
        const personils = await prisma.personil.findMany({
            include: {
                jadwalkuliahstatis: true,
                rekapkeuangan: true,
                alokasijaga: {
                    include: {
                        masterpraktikum: true
                    }
                }
            }
        });

        // Map database lowercase casing to frontend camelCase formats
        const mapped = personils.map(p => ({
            id: p.id,
            nama: p.nama,
            role: p.role,
            kontak_wa: p.kontak_wa,
            jadwal_statis: p.jadwalkuliahstatis,
            rekap_keuangan: p.rekapkeuangan,
            alokasi_jaga: p.alokasijaga.map(aj => ({
                id: aj.id,
                personilId: aj.personilId,
                masterPraktikumId: aj.masterPraktikumId,
                masterPraktikum: aj.masterpraktikum
            }))
        }));

        res.json(mapped);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// CREATE personil
app.post('/api/personil', async (req, res) => {
    const { nama, role, kontak_wa } = req.body;
    try {
        const personil = await prisma.personil.create({
            data: { nama, role, kontak_wa }
        });
        res.json(personil);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// UPDATE personil
app.put('/api/personil/:id', async (req, res) => {
    const { id } = req.params;
    const { nama, role, kontak_wa } = req.body;
    try {
        const personil = await prisma.personil.update({
            where: { id: parseInt(id) },
            data: { nama, role, kontak_wa }
        });
        res.json(personil);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE personil
app.delete('/api/personil/:id', async (req, res) => {
    const { id } = req.params;
    try {
        // Delete all dependent records using lowercase models
        await prisma.jadwalkuliahstatis.deleteMany({ where: { personilId: parseInt(id) } });
        await prisma.alokasijaga.deleteMany({ where: { personilId: parseInt(id) } });
        await prisma.rekapkeuangan.deleteMany({ where: { personilId: parseInt(id) } });
        
        const personil = await prisma.personil.delete({
            where: { id: parseInt(id) }
        });
        res.json({ message: "Personil berhasil terhapus", personil });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// =================== STATIC SCHEDULE ENDPOINTS ===================

// BULK Save Static Schedules for a Personil
app.post('/api/jadwal/bulk', async (req, res) => {
    const { personilId, schedules } = req.body; // schedules: [{ hari, stringKRS }, ...]
    try {
        // Delete all old schedules for this personil first (lowercase model)
        await prisma.jadwalkuliahstatis.deleteMany({ where: { personilId: parseInt(personilId) } });
        
        const created = [];
        for (const item of schedules) {
            if (!item.stringKRS) continue;
            const { jamMulaiIndeks, jamSelesaiIndeks } = dapatkanRentangWaktu(item.stringKRS);
            const s = await prisma.jadwalkuliahstatis.create({
                data: {
                    personilId: parseInt(personilId),
                    hari: item.hari,
                    jamMulaiIndeks,
                    jamSelesaiIndeks
                }
            });
            created.push(s);
        }
        res.json({ message: "Jadwal bulk berhasil disimpan", created });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// =================== MASTER PRAKTIKUM ENDPOINTS ===================

// GET all practicum classes (lowercase model)
app.get('/api/praktikum', async (req, res) => {
    try {
        const praktikum = await prisma.masterpraktikum.findMany();
        res.json(praktikum);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// CREATE practicum class
app.post('/api/praktikum', async (req, res) => {
    const { hari, shift, sesi } = req.body;
    try {
        const praktikum = await prisma.masterpraktikum.create({
            data: { hari, shift: parseInt(shift), sesi }
        });
        res.json(praktikum);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// UPDATE practicum class
app.put('/api/praktikum/:id', async (req, res) => {
    const { id } = req.params;
    const { hari, shift, sesi } = req.body;
    try {
        const praktikum = await prisma.masterpraktikum.update({
            where: { id: parseInt(id) },
            data: { hari, shift: parseInt(shift), sesi }
        });
        res.json(praktikum);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE practicum class
app.delete('/api/praktikum/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await prisma.alokasijaga.deleteMany({ where: { masterPraktikumId: parseInt(id) } });
        const praktikum = await prisma.masterpraktikum.delete({
            where: { id: parseInt(id) }
        });
        res.json({ message: "Master Praktikum berhasil terhapus", praktikum });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// =================== AUTO-ASSIGN SCHEDULER ENDPOINTS ===================

// GET Current Scheduled Slots
app.get('/api/schedule/current', async (req, res) => {
    try {
        const alokasi = await prisma.alokasijaga.findMany({
            include: {
                personil: true,
                masterpraktikum: true
            }
        });
        
        // Map to camelCase for frontend
        const mapped = alokasi.map(a => ({
            id: a.id,
            personilId: a.personilId,
            masterPraktikumId: a.masterPraktikumId,
            personil: a.personil,
            masterPraktikum: a.masterpraktikum
        }));

        res.json(mapped);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// SAVE/Commit Weekly Schedule
app.post('/api/schedule/save', async (req, res) => {
    const { alokasi } = req.body; // array of { personilId, masterPraktikumId }
    try {
        await prisma.$transaction([
            prisma.alokasijaga.deleteMany({}), // Wipe old weekly schedule
            prisma.alokasijaga.createMany({
                data: alokasi.map(item => ({
                    personilId: parseInt(item.personilId),
                    masterPraktikumId: parseInt(item.masterPraktikumId)
                }))
            })
        ]);
        res.json({ message: "Jadwal mingguan berhasil disimpan!" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Helper: Backtracking Auto-Schedule Solver and Database Committer
async function jalankanPenjadwalanOtomatis() {
    const personils = await prisma.personil.findMany({
        include: {
            jadwalkuliahstatis: true
        }
    });
    const classes = await prisma.masterpraktikum.findMany();

    if (personils.length === 0) {
        throw new Error("Tidak ada data Personil untuk dijadwalkan.");
    }
    if (classes.length === 0) {
        throw new Error("Tidak ada data Master Praktikum untuk dijadwalkan.");
    }

    const N = personils.length;
    const C = classes.length;

    // Helper: get Gunadarma hour indices for a shift (1-7)
    function getShiftHours(shiftNum) {
        // Karena sistem sekarang menggunakan Sesi (1-14) per jam, maka index mulai dan akhir sama
        return [shiftNum, shiftNum];
    }

    // conflicts[p][c] is true if personil p is busy during practicum class c
    const conflicts = Array(N).fill(null).map(() => Array(C).fill(false));
    for (let p = 0; p < N; p++) {
        const p_schedules = personils[p].jadwalkuliahstatis;
        for (let c = 0; c < C; c++) {
            const cls = classes[c];
            const [h_start, h_end] = getShiftHours(cls.shift);

            // Overlap check
            conflicts[p][c] = p_schedules.some(js => {
                if (js.hari.toLowerCase() !== cls.hari.toLowerCase()) return false;
                return js.jamMulaiIndeks <= h_end && js.jamSelesaiIndeks >= h_start;
            });
        }
    }

    // Backtracking CSP Solver function
    function solveCSP(minPerClass, maxPerClass) {
        const assignments = Array(N).fill(null).map(() => []);
        const classCounts = Array(C).fill(0);

        // Time overlap between two practicum classes (same day and shift)
        function overlapsInTime(c1, c2) {
            const cls1 = classes[c1];
            const cls2 = classes[c2];
            return cls1.hari.toLowerCase() === cls2.hari.toLowerCase() && cls1.shift === cls2.shift;
        }

        function search(p_idx, start_c_idx) {
            if (p_idx === N) {
                // Check if min staffing holds for all classes
                for (let c = 0; c < C; c++) {
                    if (classCounts[c] < minPerClass) return false;
                }
                return true;
            }

            if (assignments[p_idx].length === 2) {
                return search(p_idx + 1, 0);
            }

            for (let c = start_c_idx; c < C; c++) {
                if (classCounts[c] >= maxPerClass) continue;
                if (conflicts[p_idx][c]) continue;

                // Ensure no same-time shift overlap in personil's schedule
                let timeConflict = false;
                for (const assigned_c of assignments[p_idx]) {
                    if (overlapsInTime(assigned_c, c)) {
                        timeConflict = true;
                        break;
                    }
                }
                if (timeConflict) continue;

                // Try assigning
                assignments[p_idx].push(c);
                classCounts[c]++;

                if (search(p_idx, c + 1)) return true;

                // Backtrack
                assignments[p_idx].pop();
                classCounts[c]--;
            }
            return false;
        }

        if (search(0, 0)) return assignments;
        return null;
    }

    // Step-wise constraint relaxation
    let result = null;
    let usedMin = 0;
    let usedMax = 0;

    const targetAverage = (2 * N) / C;
    const strictMin = Math.floor(targetAverage);
    const strictMax = Math.ceil(targetAverage);

    // Run CSP Solver
    result = solveCSP(strictMin, strictMax);
    if (result) {
        usedMin = strictMin;
        usedMax = strictMax;
    } else {
        // Relax constraints slightly (+- 1 from average)
        const relaxedMin = Math.max(0, strictMin - 1);
        const relaxedMax = strictMax + 1;
        result = solveCSP(relaxedMin, relaxedMax);
        if (result) {
            usedMin = relaxedMin;
            usedMax = relaxedMax;
        } else {
            // Fallback to fully relaxed
            result = solveCSP(0, N);
            if (result) {
                usedMin = 0;
                usedMax = N;
            }
        }
    }

    if (!result) {
        throw new Error("Penjadwalan otomatis gagal karena batasan jadwal statis asisten terlalu ketat. Kurangi beberapa jadwal statis di Personil lalu coba lagi.");
    }

    // Reconstruct schedule objects & prepare bulk data
    const schedule = [];
    const alokasiData = [];
    for (let p = 0; p < N; p++) {
        const personil = personils[p];
        const assignedClasses = result[p];
        for (const c_idx of assignedClasses) {
            const cls = classes[c_idx];
            schedule.push({
                personilId: personil.id,
                personil: { id: personil.id, nama: personil.nama, role: personil.role, kontak_wa: personil.kontak_wa },
                masterPraktikumId: cls.id,
                masterPraktikum: cls
            });
            alokasiData.push({
                personilId: personil.id,
                masterPraktikumId: cls.id
            });
        }
    }

    // Automatically commit weekly schedule to database
    await prisma.$transaction([
        prisma.alokasijaga.deleteMany({}),
        prisma.alokasijaga.createMany({
            data: alokasiData
        })
    ]);

    return {
        schedule,
        minStaffing: usedMin,
        maxStaffing: usedMax
    };
}

// GENERATE Schedule with backtracking CSP solver
app.post('/api/schedule/generate', async (req, res) => {
    try {
        const resObj = await jalankanPenjadwalanOtomatis();
        res.json({
            message: "Jadwal berhasil digenerate otomatis",
            minStaffing: resObj.minStaffing,
            maxStaffing: resObj.maxStaffing,
            schedule: resObj.schedule
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// NEW: Upload KRS Image, parse schedule, save static schedule, run scheduler, save & return final schedule
app.post('/api/schedule/upload-and-assign', upload.single('krsImage'), async (req, res) => {
    try {
        const personilId = parseInt(req.body.personilId);
        if (!personilId) {
            return res.status(400).json({ error: "Pilih Asisten / Programmer terlebih dahulu." });
        }
        if (!req.file) {
            return res.status(400).json({ error: "Upload gambar KRS dulu brok." });
        }

        // 1. Run OCR using Tesseract.js
        const { data: { text } } = await Tesseract.recognize(
            req.file.path,
            'eng'
        );

        const results = [];
        // Extract pattern, e.g. "Senin 4/5/6" or "Selasa: 1/2"
        const regexCombo = /(senin|selasa|rabu|kamis|jumat|sabtu|minggu)[\s\:\-]*(\d+(?:\/\d+)+)/gi;
        let match;
        while ((match = regexCombo.exec(text)) !== null) {
            const rawDay = match[1];
            const capitalizeDay = rawDay.charAt(0).toUpperCase() + rawDay.slice(1).toLowerCase();
            results.push({
                hari: capitalizeDay,
                stringKRS: match[2]
            });
        }

        // Fallback: extract any slash numbers and suggest days
        if (results.length === 0) {
            const regexPolaJadwal = /\d+(?:\/\d+)+/g;
            const matches = text.match(regexPolaJadwal) || [];
            const days = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
            matches.forEach((m, idx) => {
                results.push({
                    hari: days[idx % 7],
                    stringKRS: m
                });
            });
        }

        // 2. Clear old static schedules and save the newly extracted ones
        await prisma.jadwalkuliahstatis.deleteMany({ where: { personilId } });
        
        for (const item of results) {
            const { jamMulaiIndeks, jamSelesaiIndeks } = dapatkanRentangWaktu(item.stringKRS);
            await prisma.jadwalkuliahstatis.create({
                data: {
                    personilId,
                    hari: item.hari,
                    jamMulaiIndeks,
                    jamSelesaiIndeks
                }
            });
        }

        // 3. Re-run scheduling solver and auto-commit
        const resObj = await jalankanPenjadwalanOtomatis();

        res.json({
            message: "KRS berhasil diproses! Jadwal kuliah statis disimpan, dan jadwal jaga mingguan berhasil di-update.",
            jadwalTerekstrak: results,
            schedule: resObj.schedule
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// =================== OCR RECONSTRUCTION ENDPOINT (LEGACY COMPATIBILITY) ===================
app.post('/api/jadwal/ocr', upload.single('krsImage'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).send('Upload gambar KRS dulu brok.');

        const { data: { text } } = await Tesseract.recognize(
            req.file.path,
            'eng'
        );

        const results = [];
        const regexCombo = /(senin|selasa|rabu|kamis|jumat|sabtu|minggu)[\s\:\-]*(\d+(?:\/\d+)+)/gi;
        let match;
        while ((match = regexCombo.exec(text)) !== null) {
            const rawDay = match[1];
            const capitalizeDay = rawDay.charAt(0).toUpperCase() + rawDay.slice(1).toLowerCase();
            results.push({
                hari: capitalizeDay,
                stringKRS: match[2]
            });
        }

        if (results.length === 0) {
            const regexPolaJadwal = /\d+(?:\/\d+)+/g;
            const matches = text.match(regexPolaJadwal) || [];
            const days = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
            matches.forEach((m, idx) => {
                results.push({
                    hari: days[idx % 7],
                    stringKRS: m
                });
            });
        }

        res.json({ 
            message: "Hasil ekstraksi OCR", 
            rawText: text,
            jadwalTerekstrak: results 
        });
    } catch (error) {
        res.status(500).json({ error: "Gagal baca OCR", detail: error.message });
    }
});

// =================== FINANCIAL ENDPOINTS ===================

// GET all financial logs (lowercase model)
app.get('/api/keuangan', async (req, res) => {
    try {
        const rekap = await prisma.rekapkeuangan.findMany({
            include: {
                personil: true
            },
            orderBy: {
                tanggal: 'desc'
            }
        });
        res.json(rekap);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST record late fine (Rp 2.000 / Min) (lowercase model)
app.post('/api/keuangan/denda', async (req, res) => {
    const { personilId, menitTelat } = req.body;
    const nominalDenda = parseInt(menitTelat) * 2000;
    try {
        const denda = await prisma.rekapkeuangan.create({
            data: {
                personilId: parseInt(personilId),
                kategori: "Denda Keterlambatan",
                nominal: nominalDenda,
                status: "Belum Lunas"
            },
            include: {
                personil: true
            }
        });
        res.json({ message: "Denda keterlambatan berhasil dicatat", denda });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST generate monthly cash (Rp 20.000) for all active personil (lowercase model)
app.post('/api/keuangan/kas-bulanan', async (req, res) => {
    try {
        const personils = await prisma.personil.findMany();
        if (personils.length === 0) {
            return res.status(400).json({ error: "Tidak ada data Personil untuk ditagih kas." });
        }

        const created = [];
        for (const p of personils) {
            const kas = await prisma.rekapkeuangan.create({
                data: {
                    personilId: p.id,
                    kategori: "Uang Kas Bulanan",
                    nominal: 20000,
                    status: "Belum Lunas"
                },
                include: {
                    personil: true
                }
            });
            created.push(kas);
        }
        res.json({ message: `Uang Kas Bulanan berhasil digenerate untuk ${personils.length} personil.`, created });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PUT toggle pay status (lowercase model)
app.put('/api/keuangan/:id/status', async (req, res) => {
    const { id } = req.params;
    const { status } = req.body; // "Lunas" / "Belum Lunas"
    try {
        const updated = await prisma.rekapkeuangan.update({
            where: { id: parseInt(id) },
            data: { status }
        });
        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE financial record (lowercase model)
app.delete('/api/keuangan/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await prisma.rekapkeuangan.delete({
            where: { id: parseInt(id) }
        });
        res.json({ message: "Rekap keuangan terhapus" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const PORT = 5000;
app.listen(PORT, () => console.log(`Backend Siprak jalan di port ${PORT} bro!`));