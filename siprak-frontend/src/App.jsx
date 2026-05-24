import { useState, useEffect } from 'react';
import axios from 'axios';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx-js-style';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

// SVG Icons
const Icons = {
  Overview: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>,
  Personil: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  Practikum: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/><path d="M6 6h10"/><path d="M6 10h10"/><path d="M6 14h10"/></svg>,
  Scheduler: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  Plus: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  Trash: () => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>,
  Save: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>,
  Generate: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
};

function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedWeek, setSelectedWeek] = useState(1);

  // Backend URL configuration
  const API_URL = 'http://localhost:5000/api';

  // State Lists
  const [personils, setPersonils] = useState([]);
  const [praktikums, setPraktikums] = useState([]);
  const [weeklySchedules, setWeeklySchedules] = useState([]); // Draftweekly schedule

  // Form inputs
  const [newPersonil, setNewPersonil] = useState({ nama: '', role: 'Asisten', kontak_wa: '' });
  const [newPraktikum, setNewPraktikum] = useState({ hari: 'Senin', shift: '1', sesi: '07:30 - 08:30' });

  // Modal static schedule variables
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPersonil, setEditingPersonil] = useState(null);
  const [tempSchedule, setTempSchedule] = useState({}); // { 'Senin': [ [1,2], [3,4] ] }
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrSuggestions, setOcrSuggestions] = useState([]);

  // Custom Notifications
  const [toast, setToast] = useState({ show: false, message: '', type: 'info' });
  const showToast = (message, type = 'info') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'info' }), 4000);
  };

  const [confirmDialog, setConfirmDialog] = useState({ show: false, message: '', onConfirm: null });
  const showConfirm = (message, onConfirm) => {
    setConfirmDialog({ show: true, message, onConfirm });
  };

  // End-to-End Auto Schedule state
  const [autoScheduleFile, setAutoScheduleFile] = useState(null);
  const [autoSchedulePersonilId, setAutoSchedulePersonilId] = useState('');
  const [autoScheduleLoading, setAutoScheduleLoading] = useState(false);

  // Fetch initial data
  const fetchData = async () => {
    try {
      const pRes = await axios.get(`${API_URL}/personil`);
      setPersonils(pRes.data);

      const prRes = await axios.get(`${API_URL}/praktikum?minggu=${selectedWeek}`);
      setPraktikums(prRes.data);

      const sRes = await axios.get(`${API_URL}/schedule/current?minggu=${selectedWeek}`);
      setWeeklySchedules(sRes.data);
    } catch (error) {
      console.error("Gagal fetch data backend:", error);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedWeek]);

  const MATRIKS_GUNADARMA = {
    1: { start: "07:30", end: "08:30" },
    2: { start: "08:30", end: "09:30" },
    3: { start: "09:30", end: "10:30" },
    4: { start: "10:30", end: "11:30" },
    5: { start: "11:30", end: "12:30" },
    6: { start: "12:30", end: "13:30" },
    7: { start: "13:30", end: "14:30" },
    8: { start: "14:30", end: "15:30" },
    9: { start: "15:30", end: "16:30" },
    10: { start: "16:30", end: "17:30" },
    11: { start: "17:30", end: "18:30" },
    12: { start: "18:30", end: "19:30" },
    13: { start: "19:30", end: "20:30" },
    14: { start: "20:30", end: "21:30" }
  };

  const shiftHours = {};
  const shiftHourRange = {};
  for(let i=1; i<=14; i++) {
     shiftHours[i] = `${MATRIKS_GUNADARMA[i].start} - ${MATRIKS_GUNADARMA[i].end}`;
     shiftHourRange[i] = [i, i];
  }

  const days = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

  // =================== PERSONIL CRUD ===================

  const handleAddPersonil = async (e) => {
    e.preventDefault();
    if (!newPersonil.nama.trim()) {
      showToast("Nama personil tidak boleh kosong.", "error");
      return;
    }
    if (newPersonil.kontak_wa && !/^\d+$/.test(newPersonil.kontak_wa)) {
      showToast("Kontak WA hanya boleh berisi angka (tanpa + atau spasi).", "error");
      return;
    }
    try {
      await axios.post(`${API_URL}/personil`, newPersonil);
      setNewPersonil({ nama: '', role: 'Asisten', kontak_wa: '' });
      fetchData();
      showToast("Personil berhasil ditambahkan.", "success");
    } catch (error) {
      showToast("Error adding personil: " + error.message, "error");
    }
  };

  const handleDeletePersonil = (id) => {
    showConfirm("Yakin ingin menghapus personil ini beserta seluruh datanya?", async () => {
      try {
        await axios.delete(`${API_URL}/personil/${id}`);
        fetchData();
        showToast("Personil berhasil dihapus.", "success");
      } catch (error) {
        showToast("Error deleting personil: " + error.message, "error");
      }
    });
  };

  // =================== MASTER PRAKTIKUM CRUD ===================

  const handleAddPraktikum = async (e) => {
    e.preventDefault();
    if (!newPraktikum.hari || !newPraktikum.shift || !newPraktikum.sesi.trim()) {
      showToast("Lengkapi semua field master praktikum.", "error");
      return;
    }
    try {
      await axios.post(`${API_URL}/praktikum`, newPraktikum);
      fetchData();
      showToast("Shift Praktikum berhasil ditambahkan.", "success");
    } catch (error) {
      showToast("Error adding practicum: " + error.message, "error");
    }
  };

  const handleDeletePraktikum = (id) => {
    showConfirm("Yakin ingin menghapus kelas praktikum ini?", async () => {
      try {
        await axios.delete(`${API_URL}/praktikum/${id}`);
        fetchData();
        showToast("Kelas praktikum berhasil dihapus.", "success");
      } catch (error) {
        showToast("Error deleting practicum: " + error.message, "error");
      }
    });
  };

  // =================== STATIC SCHEDULE MODAL & TESSERACT OCR ===================

  const openScheduleModal = (personil) => {
    setEditingPersonil(personil);
    setOcrSuggestions([]);
    
    // Initialize temporary schedule state from database record
    // We map static schedules to: { 'Senin': [1,2,3], 'Selasa': [] } representing busy hours
    const schedObj = {};
    days.forEach(d => {
      schedObj[d] = Array(14).fill(false);
    });

    personil.jadwal_statis.forEach(js => {
      const day = js.hari;
      if (schedObj[day]) {
        for (let i = js.jamMulaiIndeks; i <= js.jamSelesaiIndeks; i++) {
          schedObj[day][i - 1] = true; // 0-indexed
        }
      }
    });

    setTempSchedule(schedObj);
    setModalOpen(true);
  };

  const toggleScheduleHour = (day, hourIdx) => {
    setTempSchedule(prev => {
      const daySched = [...prev[day]];
      daySched[hourIdx] = !daySched[hourIdx];
      return { ...prev, [day]: daySched };
    });
  };

  const handleSaveStaticSchedule = async () => {
    // Reconstruct list of ranges from our boolean arrays
    const schedulesList = [];
    
    days.forEach(day => {
      const hours = tempSchedule[day];
      let startIdx = null;

      for (let i = 0; i < 14; i++) {
        if (hours[i]) {
          if (startIdx === null) {
            startIdx = i + 1; // 1-indexed
          }
        } else {
          if (startIdx !== null) {
            schedulesList.push({
              hari: day,
              stringKRS: startIdx === i ? `${startIdx}` : `${startIdx}/${i}`
            });
            startIdx = null;
          }
        }
      }
      if (startIdx !== null) {
        schedulesList.push({
          hari: day,
          stringKRS: startIdx === 14 ? "14" : `${startIdx}/14`
        });
      }
    });

    try {
      await axios.post(`${API_URL}/jadwal/bulk`, {
        personilId: editingPersonil.id,
        schedules: schedulesList
      });
      setModalOpen(false);
      fetchData();
      showToast("Jadwal kuliah statis berhasil disimpan.", "success");
    } catch (error) {
      showToast("Gagal menyimpan jadwal: " + error.message, "error");
    }
  };

  const handleOCRFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setOcrLoading(true);

    const formData = new FormData();
    formData.append('krsImage', file);

    try {
      const res = await axios.post(`${API_URL}/jadwal/ocr`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setOcrSuggestions(res.data.jadwalTerekstrak);
      showToast("OCR Selesai! Klik tombol apply untuk memasukkan saran jadwal kuliah.", "success");
    } catch (error) {
      showToast("Gagal membaca OCR gambar: " + error.message, "error");
    } finally {
      setOcrLoading(false);
    }
  };

  const applyOcrSuggestions = () => {
    setTempSchedule(prev => {
      const updated = { ...prev };
      ocrSuggestions.forEach(sug => {
        const day = sug.hari;
        if (updated[day]) {
          const pecahan = sug.stringKRS.split('/');
          const start = parseInt(pecahan[0]);
          const end = parseInt(pecahan[pecahan.length - 1]);
          for (let i = start; i <= end; i++) {
            if (i >= 1 && i <= 14) {
              updated[day][i - 1] = true;
            }
          }
        }
      });
      return updated;
    });
    setOcrSuggestions([]);
  };

  // =================== AUTO-ASSIGN SCHEDULER & MANUAL EDIT ===================

  const handleGenerateSchedule = async () => {
    try {
      const res = await axios.post(`${API_URL}/schedule/generate`, { minggu: selectedWeek });
      setWeeklySchedules(res.data.schedule);
      showToast(`${res.data.message}\nStaffing Range: ${res.data.minStaffing} - ${res.data.maxStaffing} personil per kelas.`, "success");
    } catch (error) {
      if (error.response && error.response.status === 422) {
        showToast("Gagal: " + error.response.data.error, "error");
      } else {
        showToast("Error: " + error.message, "error");
      }
    }
  };

  const handleSaveWeeklySchedule = async () => {
    try {
      await axios.post(`${API_URL}/schedule/save`, {
        minggu: selectedWeek,
        alokasi: weeklySchedules.map(s => ({
          personilId: s.personilId,
          masterPraktikumId: s.masterPraktikumId
        }))
      });
      fetchData();
      showToast(`Jadwal minggu ${selectedWeek} berhasil disimpan ke database!`, "success");
    } catch (error) {
      showToast("Gagal menyimpan jadwal mingguan: " + error.message, "error");
    }
  };

  const handleUploadAndAutoSchedule = async (e) => {
    e.preventDefault();
    if (!autoScheduleFile || !autoSchedulePersonilId) {
      showToast("Harap pilih personil dan file KRS!", "error");
      return;
    }
    setAutoScheduleLoading(true);

    const formData = new FormData();
    formData.append('krsImage', autoScheduleFile);
    formData.append('personilId', autoSchedulePersonilId);
    formData.append('minggu', selectedWeek);

    try {
      const res = await axios.post(`${API_URL}/schedule/upload-and-assign`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      showToast(`Berhasil! ${res.data.message}`, "success");
      // Refresh all data to get updated static schedules and weekly assignments
      await fetchData();
      // Clear inputs
      setAutoScheduleFile(null);
      setAutoSchedulePersonilId('');
      if (document.getElementById('krs-upload')) {
        document.getElementById('krs-upload').value = '';
      }
    } catch (error) {
      if (error.response && error.response.data && error.response.data.error) {
        showToast("Gagal: " + error.response.data.error, "error");
      } else {
        showToast("Error: " + error.message, "error");
      }
    } finally {
      setAutoScheduleLoading(false);
    }
  };

  // Manual Adjustments inside Auto-Scheduler
  const handleRemoveStaff = (masterPraktikumId, personilId) => {
    setWeeklySchedules(prev => 
      prev.filter(item => !(item.masterPraktikumId === masterPraktikumId && item.personilId === personilId))
    );
  };

  const handleAddStaff = (masterPraktikumId, personilId) => {
    // Check if already assigned to this class
    const alreadyAssigned = weeklySchedules.some(
      s => s.masterPraktikumId === masterPraktikumId && s.personilId === personilId
    );
    if (alreadyAssigned) return;

    const person = personils.find(p => p.id === personilId);
    const praktikum = praktikums.find(pr => pr.id === masterPraktikumId);

    setWeeklySchedules(prev => [
      ...prev,
      {
        personilId: person.id,
        personil: { id: person.id, nama: person.nama, role: person.role, kontak_wa: person.kontak_wa },
        masterPraktikumId: praktikum.id,
        masterPraktikum: praktikum
      }
    ]);
  };

  // Check conflicts dynamically for dropdown list
  const getAvailabilityStatus = (personil, praktikum) => {
    // 1. Check static class schedule conflict
    const [h_start, h_end] = shiftHourRange[praktikum.shift];
    const hasStaticConflict = personil.jadwal_statis.some(js => {
      if (js.hari.toLowerCase() !== praktikum.hari.toLowerCase()) return false;
      return js.jamMulaiIndeks <= h_end && js.jamSelesaiIndeks >= h_start;
    });
    if (hasStaticConflict) return "Jadwal Kuliah (Bentrok)";

    // 2. Check overlap with other assigned practicum class in draft schedule
    const hasTimeOverlap = weeklySchedules.some(s => {
      return s.personilId === personil.id && 
             s.masterPraktikum.hari.toLowerCase() === praktikum.hari.toLowerCase() && 
             s.masterPraktikum.shift === praktikum.shift;
    });
    if (hasTimeOverlap) return "Shift Sama (Bentrok)";

    // 3. Count weekly assignments in current draft
    const load = weeklySchedules.filter(s => s.personilId === personil.id).length;
    if (load >= 2) return `Beban Kerja Penuh (${load} Shift)`;

    return "Tersedia";
  };

  // =================== EXPORTS ===================

  const handleExportPNG = () => {
    const el = document.getElementById('weekly-schedule-grid');
    if (!el) return;
    html2canvas(el, { backgroundColor: '#131b2e' }).then(canvas => {
      const link = document.createElement('a');
      link.download = 'Jadwal_Praktikum_Weekly.png';
      link.href = canvas.toDataURL();
      link.click();
    });
  };

  const handleExportExcel = () => {
    const rows = weeklySchedules.map(item => ({
      'Hari': item.masterPraktikum.hari,
      'Shift': item.masterPraktikum.shift,
      'Sesi': item.masterPraktikum.sesi,
      'Nama Asisten': item.personil.nama,
      'Role': item.personil.role,
      'No WA': item.personil.kontak_wa || '-'
    }));
    const ws = XLSX.utils.json_to_sheet(rows);

    // Apply column widths
    ws['!cols'] = [
      { wch: 15 }, // Hari
      { wch: 10 }, // Shift
      { wch: 20 }, // Sesi
      { wch: 25 }, // Nama
      { wch: 15 }, // Role
      { wch: 20 }  // No WA
    ];

    // Apply header styles (purple background, white bold text)
    if (ws['!ref']) {
      const range = XLSX.utils.decode_range(ws['!ref']);
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const address = XLSX.utils.encode_col(C) + "1";
        if (!ws[address]) continue;
        ws[address].s = {
          fill: { fgColor: { rgb: "7B3FE4" } },
          font: { color: { rgb: "FFFFFF" }, bold: true },
          border: {
            top: { style: "thin", color: { rgb: "000000" } },
            bottom: { style: "thin", color: { rgb: "000000" } },
            left: { style: "thin", color: { rgb: "000000" } },
            right: { style: "thin", color: { rgb: "000000" } }
          }
        };
      }

      // Apply basic borders for data cells
      for (let R = range.s.r + 1; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const address = XLSX.utils.encode_cell({ r: R, c: C });
          if (!ws[address]) continue;
          ws[address].s = {
            border: {
              top: { style: "thin", color: { rgb: "CCCCCC" } },
              bottom: { style: "thin", color: { rgb: "CCCCCC" } },
              left: { style: "thin", color: { rgb: "CCCCCC" } },
              right: { style: "thin", color: { rgb: "CCCCCC" } }
            }
          };
        }
      }
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Jadwal Jaga M${selectedWeek}`);
    XLSX.writeFile(wb, `Jadwal_Siprak_Minggu_${selectedWeek}.xlsx`);
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.setFont("Helvetica");
    doc.setFontSize(16);
    doc.text("Sistem Manajemen & Penjadwalan Praktikum (Siprak v2.0)", 14, 15);
    doc.setFontSize(12);
    doc.text("Daftar Alokasi Jaga Asisten dan Programmer", 14, 22);

    const data = weeklySchedules.map(item => [
      item.masterPraktikum.hari,
      `Shift ${item.masterPraktikum.shift}`,
      item.masterPraktikum.sesi,
      item.personil.nama,
      item.personil.role,
      item.personil.kontak_wa || '-'
    ]);

    doc.autoTable({
      startY: 30,
      head: [['Hari', 'Shift', 'Sesi', 'Nama', 'Jabatan', 'No WA']],
      body: data,
    });
    doc.save('Jadwal_Siprak_v2.0.pdf');
  };


  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <div className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-logo">SP</div>
          <div>
            <h2 className="sidebar-title">Siprak</h2>
            <span className="sidebar-version">v2.0</span>
          </div>
        </div>

        <div className="nav-menu">
          <div className={`nav-item ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
            <Icons.Overview />
            <span>Overview</span>
          </div>
          <div className={`nav-item ${activeTab === 'personil' ? 'active' : ''}`} onClick={() => setActiveTab('personil')}>
            <Icons.Personil />
            <span>Personil & KRS</span>
          </div>
          <div className={`nav-item ${activeTab === 'praktikum' ? 'active' : ''}`} onClick={() => setActiveTab('praktikum')}>
            <Icons.Practikum />
            <span>Master Praktikum</span>
          </div>
          <div className={`nav-item ${activeTab === 'scheduler' ? 'active' : ''}`} onClick={() => setActiveTab('scheduler')}>
            <Icons.Scheduler />
            <span>Auto-Scheduler</span>
          </div>
        </div>

        <div className="sidebar-footer">
          <div className="admin-avatar">AD</div>
          <div className="admin-info">
            <h4>Admin Lab</h4>
            <p>Koordinator Utama</p>
          </div>
        </div>
      </div>

      {/* Main Content Dashboard */}
      <div className="main-content">
        
        {/* GLOBAL WEEK SELECTOR */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px', alignItems: 'center', gap: '10px' }}>
          <label style={{ fontWeight: '600', color: 'var(--text-secondary)' }}>Pilih Minggu:</label>
          <select 
            className="form-control" 
            style={{ width: '150px' }}
            value={selectedWeek} 
            onChange={(e) => setSelectedWeek(parseInt(e.target.value))}
          >
            {[1, 2, 3, 4, 5, 6, 7, 8].map(m => (
              <option key={m} value={m}>Minggu {m}</option>
            ))}
          </select>
        </div>
        
        {/* TAB OVERVIEW */}
        {activeTab === 'overview' && (
          <div>
            <div className="page-header">
              <div className="page-title">
                <h1>Dashboard Overview</h1>
                <p>Status operasional dan logistik praktikum minggu ini.</p>
              </div>
            </div>

            {/* KPI Summary Cards */}
            <div className="kpi-grid">
              <div className="kpi-card">
                <div className="kpi-info">
                  <h3>Total Personil</h3>
                  <div className="kpi-value">{personils.length} orang</div>
                </div>
                <div className="kpi-icon">
                  <Icons.Personil />
                </div>
              </div>
              <div className="kpi-card emerald">
                <div className="kpi-info">
                  <h3>Kelas Praktikum</h3>
                  <div className="kpi-value">{praktikums.length} Kelas</div>
                </div>
                <div className="kpi-icon">
                  <Icons.Practikum />
                </div>
              </div>
            </div>

            {/* Today's Schedule Table */}
            <div className="glass-container">
              <div className="container-header">
                <h3 className="container-title">Alokasi Jaga Aktif</h3>
              </div>
              
              {weeklySchedules.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '20px' }}>
                  Belum ada jadwal jaga yang aktif. Silakan buka menu <strong>Auto-Scheduler</strong> untuk membuat jadwal.
                </p>
              ) : (
                <div className="table-responsive">
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>Hari</th>
                        <th>Shift</th>
                        <th>Sesi</th>
                        <th>Nama Jaga</th>
                        <th>Role</th>
                        <th>WhatsApp</th>
                      </tr>
                    </thead>
                    <tbody>
                      {weeklySchedules.map((ws, i) => (
                        <tr key={i}>
                          <td><strong>{ws.masterPraktikum.hari}</strong></td>
                          <td><span className="badge badge-primary">Sesi {ws.masterPraktikum.shift}</span></td>
                          <td>{ws.masterPraktikum.sesi}</td>
                          <td><span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{ws.personil.nama}</span></td>
                          <td>{ws.personil.role}</td>
                          <td>
                            {ws.personil.kontak_wa ? (
                              <a 
                                href={`https://wa.me/${ws.personil.kontak_wa}`} 
                                target="_blank" 
                                rel="noreferrer"
                                style={{ color: 'var(--accent-info)', textDecoration: 'none', fontWeight: '500' }}
                              >
                                {ws.personil.kontak_wa}
                              </a>
                            ) : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB PERSONIL */}
        {activeTab === 'personil' && (
          <div>
            <div className="page-header">
              <div className="page-title">
                <h1>Daftar Asisten & Programmer</h1>
                <p>Kelola data personil beserta pengenalan KRS kuliah statis mereka.</p>
              </div>
            </div>

            <div className="glass-container" style={{ marginBottom: '24px' }}>
              <div className="container-header">
                <h3 className="container-title">Tambah Personil Baru</h3>
              </div>
              <form onSubmit={handleAddPersonil} className="form-grid">
                <div className="form-group">
                  <label>Nama Lengkap</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="Contoh: Budi Santoso"
                    value={newPersonil.nama}
                    onChange={(e) => setNewPersonil({ ...newPersonil, nama: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Jabatan / Role</label>
                  <select 
                    className="form-control"
                    value={newPersonil.role}
                    onChange={(e) => setNewPersonil({ ...newPersonil, role: e.target.value })}
                  >
                    <option value="Asisten">Asisten</option>
                    <option value="Programmer">Programmer</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Nomor WhatsApp (Kode Negara)</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="Contoh: 62812345678"
                    value={newPersonil.kontak_wa}
                    onChange={(e) => setNewPersonil({ ...newPersonil, kontak_wa: e.target.value })}
                  />
                </div>
                <div className="form-group" style={{ justifyContent: 'flex-end' }}>
                  <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                    <Icons.Plus /> Tambah
                  </button>
                </div>
              </form>
            </div>

            <div className="personil-grid">
              {personils.map(p => {
                return (
                  <div key={p.id} className="personil-card">
                    <div className="personil-card-header">
                      <div className="personil-initial">
                        {p.nama.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="personil-name">{p.nama}</div>
                        <div className="personil-role">{p.role}</div>
                      </div>
                    </div>

                    <div className="personil-details">
                      <div className="personil-detail-item">
                        <span>Kontak WA:</span>
                        <strong>{p.kontak_wa || '-'}</strong>
                      </div>
                      <div className="personil-detail-item">
                        <span>Jadwal Statis:</span>
                        <strong style={{ color: 'var(--accent-primary)' }}>{p.jadwal_statis.length} Hari Kuliah</strong>
                      </div>
                    </div>

                    <div className="personil-actions">
                      <button className="btn btn-secondary btn-sm" onClick={() => openScheduleModal(p)} style={{ flexGrow: 1 }}>
                        Atur Jadwal KRS
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDeletePersonil(p.id)} style={{ padding: '8px' }}>
                        <Icons.Trash />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB MASTER PRAKTIKUM */}
        {activeTab === 'praktikum' && (
          <div>
            <div className="page-header">
              <div className="page-title">
                <h1>Daftar Kelas Praktikum</h1>
                <p>Tentukan hari dan shift pelaksanaan praktikum laboratorium semester ini.</p>
              </div>
            </div>

            <div className="glass-container" style={{ marginBottom: '24px' }}>
              <div className="container-header">
                <h3 className="container-title">Tambah Shift Praktikum Baru</h3>
              </div>
              <form onSubmit={handleAddPraktikum} className="form-grid">
                <div className="form-group">
                  <label>Hari Pelaksanaan</label>
                  <select 
                    className="form-control"
                    value={newPraktikum.hari}
                    onChange={(e) => setNewPraktikum({ ...newPraktikum, hari: e.target.value })}
                  >
                    {days.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Sesi Praktikum (1-14)</label>
                  <select 
                    className="form-control"
                    value={newPraktikum.shift}
                    onChange={(e) => {
                      const sh = parseInt(e.target.value);
                      setNewPraktikum({ 
                        ...newPraktikum, 
                        shift: sh,
                        sesi: shiftHours[sh]
                      });
                    }}
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].map(s => (
                      <option key={s} value={s}>Sesi {s} ({shiftHours[s]})</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Nama Sesi (Label Rincian)</label>
                  <input 
                    type="text" 
                    className="form-control"
                    value={newPraktikum.sesi}
                    onChange={(e) => setNewPraktikum({ ...newPraktikum, sesi: e.target.value })}
                  />
                </div>
                <div className="form-group" style={{ justifyContent: 'flex-end' }}>
                  <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                    <Icons.Plus /> Tambah Shift
                  </button>
                </div>
              </form>
            </div>

            <div className="glass-container">
              <div className="container-header">
                <h3 className="container-title">Daftar Slot Praktikum</h3>
              </div>
              
              {praktikums.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '20px' }}>
                  Belum ada kelas praktikum yang terdaftar.
                </p>
              ) : (
                <div className="table-responsive">
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>Hari</th>
                        <th>Sesi</th>
                        <th>Rentang Waktu</th>
                        <th>Deskripsi Sesi</th>
                        <th style={{ textAlign: 'center' }}>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {praktikums.map(pr => (
                        <tr key={pr.id}>
                          <td><strong>{pr.hari}</strong></td>
                          <td><span className="badge badge-primary">Sesi {pr.shift}</span></td>
                          <td><code>{shiftHours[pr.shift]}</code></td>
                          <td>{pr.sesi}</td>
                          <td style={{ textAlign: 'center' }}>
                            <button className="btn btn-danger btn-sm" onClick={() => handleDeletePraktikum(pr.id)}>
                              <Icons.Trash /> Hapus
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB AUTO-SCHEDULER */}
        {activeTab === 'scheduler' && (
          <div>
            <div className="page-header">
              <div className="page-title">
                <h1>Penjadwalan Otomatis (Auto-Assign Engine)</h1>
                <p>Hasilkan dan sesuaikan alokasi jaga asisten secara real-time.</p>
              </div>
              <div className="btn-group">
                <button className="btn btn-secondary" onClick={handleExportPNG}>Ekspor Gambar</button>
                <button className="btn btn-secondary" onClick={handleExportExcel}>Ekspor Excel</button>
                <button className="btn btn-secondary" onClick={handleExportPDF}>Ekspor PDF</button>
                <button className="btn btn-emerald" onClick={handleGenerateSchedule}>
                  <Icons.Generate /> Generate Otomatis
                </button>
              </div>
            </div>

            {/* Upload & Auto-Schedule Card */}
            <div className="glass-container" style={{ marginBottom: '24px' }}>
              <div className="container-header">
                <h3 className="container-title">Upload KRS & Auto-Schedule (End-to-End)</h3>
              </div>
              <div style={{ padding: '0 20px 20px 20px' }}>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                  Pilih asisten dan upload gambar KRS. Sistem akan otomatis membaca jadwal kosong, menyimpan KRS, dan langsung memasukkan jadwal jaga asisten tersebut ke dalam draf minggu ini.
                </p>
                <form onSubmit={handleUploadAndAutoSchedule} className="form-grid" style={{ alignItems: 'flex-end' }}>
                  <div className="form-group">
                    <label>Pilih Personil</label>
                    <select 
                      className="form-control"
                      value={autoSchedulePersonilId}
                      onChange={(e) => setAutoSchedulePersonilId(e.target.value)}
                    >
                      <option value="">-- Pilih Asisten / Programmer --</option>
                      {personils.map(p => (
                        <option key={p.id} value={p.id}>{p.nama} ({p.role})</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Gambar KRS (.jpg, .png)</label>
                    <input 
                      type="file" 
                      id="krs-upload"
                      accept="image/*"
                      className="form-control"
                      onChange={(e) => setAutoScheduleFile(e.target.files[0])}
                    />
                  </div>
                  <div className="form-group">
                    <button type="submit" className="btn btn-emerald" style={{ width: '100%' }} disabled={autoScheduleLoading}>
                      {autoScheduleLoading ? 'Memproses...' : 'Upload & Jadwalkan'}
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {/* Timetable visualizer grid */}
            <div className="glass-container" style={{ padding: '20px' }}>
              <div className="container-header">
                <h3 className="container-title">Draf Alokasi Mingguan</h3>
                <button className="btn btn-primary" onClick={handleSaveWeeklySchedule}>
                  <Icons.Save /> Simpan Perubahan Jadwal
                </button>
              </div>

              <div className="scheduler-timeline-container" id="weekly-schedule-grid">
                <div className="weekly-grid">
                  
                  {/* Grid header */}
                  <div className="weekly-header">
                    <div className="weekly-header-cell">Sesi</div>
                    {days.map(d => <div key={d} className="weekly-header-cell">{d}</div>)}
                  </div>

                  {/* Grid rows */}
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].map(shiftNum => (
                    <div key={shiftNum} className="weekly-row">
                      
                      {/* Leftmost time labels */}
                      <div className="weekly-hour-label">
                        <div>
                          <strong>Sesi {shiftNum}</strong>
                          <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '2px' }}>
                            {shiftHours[shiftNum]}
                          </div>
                        </div>
                      </div>

                      {/* Day cells */}
                      {days.map(day => {
                        // Find matching practicum classes on this day and shift
                        const currentClasses = praktikums.filter(
                          pr => pr.hari.toLowerCase() === day.toLowerCase() && pr.shift === shiftNum
                        );

                        return (
                          <div key={day} className="weekly-day-cell">
                            {currentClasses.map(cls => {
                              // Find staff assigned to this class
                              const assigned = weeklySchedules.filter(ws => ws.masterPraktikumId === cls.id);
                              
                              return (
                                <div key={cls.id} className="slot-block">
                                  <div className="slot-time">{cls.sesi}</div>
                                  <div className="slot-title">Praktikum Lab</div>
                                  
                                  {/* Staff list */}
                                  <div className="slot-staff-list">
                                    {assigned.map(asg => (
                                      <span key={asg.personilId} className="slot-staff-badge">
                                        {asg.personil.nama.split(' ')[0]}
                                        <span 
                                          className="slot-staff-badge-remove" 
                                          onClick={() => handleRemoveStaff(cls.id, asg.personilId)}
                                        >
                                          &times;
                                        </span>
                                      </span>
                                    ))}
                                  </div>

                                  {/* Inline quick assignment selector */}
                                  <select 
                                    className="slot-action-btn"
                                    value=""
                                    onChange={(e) => {
                                      if (e.target.value) {
                                        handleAddStaff(cls.id, parseInt(e.target.value));
                                        e.target.value = ""; // Reset
                                      }
                                    }}
                                  >
                                    <option value="">+ Tambah Jaga</option>
                                    {personils.map(p => {
                                      const status = getAvailabilityStatus(p, cls);
                                      const isAvailable = status === "Tersedia";
                                      return (
                                        <option 
                                          key={p.id} 
                                          value={p.id} 
                                          disabled={!isAvailable && !weeklySchedules.some(s => s.masterPraktikumId === cls.id && s.personilId === p.id)}
                                        >
                                          {p.nama} ({status})
                                        </option>
                                      );
                                    })}
                                  </select>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  ))}

                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB FINANCE */}
        {activeTab === 'finance' && (
          <div>
            <div className="page-header">
              <div className="page-title">
                <h1>Konsekuensi Finansial & Administrasi</h1>
                <p>Kelola catatan uang kas bulanan dan denda keterlambatan asisten.</p>
              </div>
              <button className="btn btn-emerald" onClick={handleGenerateMonthlyKas}>
                Tagih Uang Kas Bulanan (Mei 2026)
              </button>
            </div>

            <div className="kpi-grid">
              <div className="kpi-card emerald">
                <div className="kpi-info">
                  <h3>Kas & Denda Terkumpul</h3>
                  <div className="kpi-value">Rp {finSummary.totalPaid.toLocaleString('id-ID')}</div>
                </div>
                <div className="kpi-icon">
                  <Icons.Finance />
                </div>
              </div>
              <div className="kpi-card rose">
                <div className="kpi-info">
                  <h3>Tunggakan Denda Aktif</h3>
                  <div className="kpi-value">Rp {finSummary.totalDendaUnpaid.toLocaleString('id-ID')}</div>
                </div>
                <div className="kpi-icon">
                  <Icons.Finance />
                </div>
              </div>
              <div className="kpi-card amber">
                <div className="kpi-info">
                  <h3>Tunggakan Kas Aktif</h3>
                  <div className="kpi-value">Rp {finSummary.totalKasUnpaid.toLocaleString('id-ID')}</div>
                </div>
                <div className="kpi-icon">
                  <Icons.Finance />
                </div>
              </div>
            </div>

            <div className="glass-container" style={{ marginBottom: '24px' }}>
              <div className="container-header">
                <h3 className="container-title">Catat Denda Keterlambatan</h3>
              </div>
              <form onSubmit={handleAddFine} className="form-grid">
                <div className="form-group">
                  <label>Pilih Personil</label>
                  <select 
                    className="form-control"
                    value={newFine.personilId}
                    onChange={(e) => setNewFine({ ...newFine, personilId: e.target.value })}
                  >
                    <option value="">-- Pilih Asisten / Programmer --</option>
                    {personils.map(p => (
                      <option key={p.id} value={p.id}>{p.nama} ({p.role})</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Durasi Terlambat (Dalam Menit)</label>
                  <input 
                    type="number" 
                    className="form-control" 
                    placeholder="Contoh: 10"
                    value={newFine.menitTelat}
                    onChange={(e) => setNewFine({ ...newFine, menitTelat: e.target.value })}
                  />
                </div>
                <div className="form-group" style={{ justifyContent: 'flex-end' }}>
                  <button type="submit" className="btn btn-danger" style={{ width: '100%' }}>
                    Catat Denda (Rp 2k/min)
                  </button>
                </div>
              </form>
            </div>

            <div className="glass-container">
              <div className="container-header">
                <h3 className="container-title">Buku Keuangan Administrasi</h3>
              </div>

              {finances.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '20px' }}>
                  Belum ada riwayat keuangan tercatat.
                </p>
              ) : (
                <div className="table-responsive">
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>Tanggal</th>
                        <th>Nama Personil</th>
                        <th>Kategori Kelola</th>
                        <th>Nominal</th>
                        <th>Status</th>
                        <th style={{ textAlign: 'center' }}>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {finances.map(f => (
                        <tr key={f.id}>
                          <td>{new Date(f.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                          <td><strong>{f.personil.nama}</strong></td>
                          <td>
                            <span className={`badge ${f.kategori === 'Uang Kas Bulanan' ? 'badge-primary' : 'badge-danger'}`}>
                              {f.kategori}
                            </span>
                          </td>
                          <td><strong>Rp {f.nominal.toLocaleString('id-ID')}</strong></td>
                          <td>
                            <button 
                              className={`btn btn-sm ${f.status === 'Lunas' ? 'btn-emerald' : 'btn-secondary'}`}
                              onClick={() => handleToggleKeuanganStatus(f.id, f.status)}
                            >
                              {f.status}
                            </button>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button className="btn btn-danger btn-sm" onClick={() => handleDeleteKeuangan(f.id)}>
                              <Icons.Trash />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      {/* POPUP MODAL: STATIC SCHEDULE MANAGER */}
      {modalOpen && editingPersonil && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '800px' }}>
            <div className="modal-header">
              <h3>Jadwal Kuliah Tetap (KRS) - {editingPersonil.nama}</h3>
              <button className="modal-close" onClick={() => setModalOpen(false)}>&times;</button>
            </div>
            
            <div className="modal-body">
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                Tandai jam perkuliahan di bawah. Jam yang berwarna biru berarti asisten <strong>Sibuk (Kuliah)</strong> dan tidak bisa dijadwalkan jaga praktikum.
              </p>

              {/* Static Schedule Toggler Grid */}
              <div className="schedule-grid-container" style={{ marginBottom: '24px' }}>
                <table className="schedule-table">
                  <thead>
                    <tr>
                      <th>Hari</th>
                      {[1,2,3,4,5,6,7,8,9,10,11,12,13,14].map(h => <th key={h}>J-{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {days.map(day => (
                      <tr key={day}>
                        <td style={{ fontWeight: '700', fontSize: '12px', background: 'var(--bg-tertiary)' }}>{day}</td>
                        {Array(14).fill(null).map((_, idx) => {
                          const isBusy = tempSchedule[day]?.[idx];
                          return (
                            <td 
                              key={idx}
                              className={`schedule-cell ${isBusy ? 'active' : ''}`}
                              onClick={() => toggleScheduleHour(day, idx)}
                              title={`${MATRIKS_GUNADARMA[idx+1].start} - ${MATRIKS_GUNADARMA[idx+1].end}`}
                            >
                              {idx + 1}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* OCR Uploader Section */}
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
                <h4>Metode Cepat: Upload Berkas KRS (OCR Smart Reader)</h4>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                  Upload foto/screenshot KRS (.png, .jpg) asisten. Sistem akan otomatis mendeteksi pola perkuliahan statis.
                </p>

                <div className="d-flex align-center gap-2">
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={handleOCRFileChange}
                    className="form-control"
                    style={{ flexGrow: 1 }}
                  />
                  {ocrLoading && <span style={{ fontSize: '13px', color: 'var(--accent-primary)' }}>Membaca gambar...</span>}
                </div>

                {ocrSuggestions.length > 0 && (
                  <div className="ocr-result-panel">
                    <h5 style={{ marginBottom: '10px', fontSize: '13px', fontWeight: '700' }}>Jadwal Ditemukan di KRS:</h5>
                    <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                      {ocrSuggestions.map((sug, i) => (
                        <div key={i} className="ocr-result-item">
                          <span><strong>{sug.hari}</strong>: Jam ke-{sug.stringKRS}</span>
                          <span className="badge badge-emerald">Valid</span>
                        </div>
                      ))}
                    </div>
                    <button className="btn btn-emerald btn-sm mt-4" onClick={applyOcrSuggestions}>
                      Terapkan Saran Jadwal KRS ke Tabel
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Batal</button>
              <button className="btn btn-primary" onClick={handleSaveStaticSchedule}>Simpan Jadwal Kuliah</button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Toast Notification */}
      {toast.show && (
        <div className={`toast-notification ${toast.type}`}>
          {toast.message}
        </div>
      )}

      {/* Custom Confirm Dialog */}
      {confirmDialog.show && (
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
          <div className="modal-content confirm-modal">
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: '18px' }}>Konfirmasi</h3>
            </div>
            <div className="modal-body">
              <p style={{ margin: 0, color: 'var(--text-primary)' }}>{confirmDialog.message}</p>
            </div>
            <div className="modal-footer" style={{ marginTop: '20px' }}>
              <button className="btn btn-secondary" onClick={() => setConfirmDialog({ show: false, message: '', onConfirm: null })}>Batal</button>
              <button className="btn btn-danger" onClick={() => {
                if (confirmDialog.onConfirm) confirmDialog.onConfirm();
                setConfirmDialog({ show: false, message: '', onConfirm: null });
              }}>Ya, Lanjutkan</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;