import { initializeApp } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, doc, updateDoc, query, orderBy, serverTimestamp, where } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBJA-HphBU3-egRvAdcYdzTB_Bf9-mnjZY",
  authDomain: "bankbendahara.firebaseapp.com",
  projectId: "bankbendahara",
  storageBucket: "bankbendahara.firebasestorage.app",
  messagingSenderId: "87938401504",
  appId: "1:87938401504:web:9da3e9ca0eaf1f6ad27c85"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ==========================================
// IDENTITAS DEVICE
// ==========================================
let deviceId = localStorage.getItem('maginti_device_id');
if (!deviceId) {
  deviceId = 'device_' + Math.random().toString(36).substr(2, 9);
  localStorage.setItem('maginti_device_id', deviceId);
}

let allPhotos = [];
let currentCategory = "all";
const defaultIcons = { "TK MAGINTI": "bx-book-reader", "SD NEGERI 1": "bx-building", "SMP NEGERI 1": "bx-buildings", "SMA NEGERI 2": "bx-graduation", "SUNSET SANRES": "bx-sun", "STREET VIEW": "bx-map-alt" };

// Daftarkan fungsi ke window agar bisa diakses dari atribut HTML onclick
window.openModal = (id) => { document.getElementById(id).classList.add('active'); document.body.classList.add('no-scroll'); }
window.closeModal = (id) => { document.getElementById(id).classList.remove('active'); document.body.classList.remove('no-scroll'); }
window.openInfo = () => { closeModal('menuModal'); openModal('infoModal'); }

document.getElementById('btnMenu').onclick = () => openModal('menuModal');
document.getElementById('btnNotif').onclick = () => { openModal('notifModal'); document.getElementById('notifBadge').style.display = 'none'; }

document.getElementById('btnAddPhoto').onclick = () => { 
  if(checkDailyLimit()) {
      alert("Limit Tercapai! Lu udah kirim 3 foto hari ini, Bro. Besok lagi ya!");
      return;
  }
  populateCategoryDropdown();
  const savedName = localStorage.getItem('maginti_submitter_name');
  if(savedName) document.getElementById('subName').value = savedName;
  openModal('submitModal'); 
}

let currentSlide = 0;
const slides = document.querySelectorAll('.banner-slide');
setInterval(() => {
  slides[currentSlide].classList.remove('active');
  currentSlide = (currentSlide + 1) % slides.length;
  slides[currentSlide].classList.add('active');
}, 4500);

if (localStorage.getItem('maginti_theme') === 'light') document.body.classList.add('light-mode');
document.getElementById('btnTheme').onclick = () => {
  document.body.classList.toggle('light-mode');
  localStorage.setItem('maginti_theme', document.body.classList.contains('light-mode') ? 'light' : 'dark');
};

// ==========================================
// LISTENER FIRESTORE (GALERI)
// ==========================================
const qPhotos = query(collection(db, "submissions"), orderBy("timestamp", "desc"));
onSnapshot(qPhotos, (snapshot) => {
  allPhotos = [];
  snapshot.forEach(doc => allPhotos.push({ id: doc.id, ...doc.data() }));
  renderGallery();
  if(document.getElementById('adminModal').classList.contains('active')) renderAdminDashboard();
});

const qNotif = query(collection(db, "notifications"), where("deviceId", "==", deviceId));
onSnapshot(qNotif, (snapshot) => {
  const list = document.getElementById('notifList');
  list.innerHTML = '';
  let unreadCount = 0;
  let hasData = false;

  snapshot.forEach(docSnap => {
    hasData = true;
    const n = docSnap.data();
    if(!n.read) unreadCount++;
    
    list.innerHTML += `
      <div class="admin-item" style="display:block; padding:16px; border-left: 4px solid ${n.status === 'approved' ? '#10b981' : '#ef4444'};">
        <p style="font-size:14px; margin-bottom:4px; font-weight: ${n.read ? 'normal' : 'bold'};">${n.message}</p>
        <span style="font-size:11px; color:var(--text-muted);">${n.timestamp ? n.timestamp.toDate().toLocaleString('id-ID') : 'Baru saja'}</span>
      </div>`;
  });
  if(!hasData) list.innerHTML = '<p style="color:var(--text-muted); font-size:14px;">Belum ada notifikasi.</p>';
  document.getElementById('notifBadge').style.display = unreadCount > 0 ? 'block' : 'none';
});

function renderGallery() {
  const approvedPhotos = allPhotos.filter(p => p.status === 'approved');
  const catNav = document.getElementById('categoryNav');
  const gallery = document.getElementById('galleryContainer');
  const searchQ = document.getElementById('searchInput').value.toLowerCase();

  const uniqueCats = [...new Set(approvedPhotos.map(p => p.category))];
  catNav.innerHTML = `<button class="cat-btn ${currentCategory === 'all' ? 'active' : ''}" data-cat="all"><i class='bx bx-grid-alt'></i> SEMUA</button>`;
  
  uniqueCats.forEach(cat => {
    const icon = defaultIcons[cat.toUpperCase()] || 'bx-folder';
    const isActive = currentCategory === cat ? 'active' : '';
    catNav.innerHTML += `<button class="cat-btn ${isActive}" data-cat="${cat}"><i class='bx ${icon}'></i> ${cat}</button>`;
  });

  document.querySelectorAll('.cat-btn').forEach(btn => {
    btn.onclick = (e) => { currentCategory = e.currentTarget.dataset.cat; renderGallery(); }
  });

  gallery.innerHTML = '';
  const filtered = approvedPhotos.filter(p => {
    const matchCat = currentCategory === 'all' || p.category === currentCategory;
    const matchSearch = p.title.toLowerCase().includes(searchQ) || p.category.toLowerCase().includes(searchQ) || p.submitterName.toLowerCase().includes(searchQ);
    return matchCat && matchSearch;
  });

  if(filtered.length === 0) {
    gallery.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 40px;">Foto tidak ditemukan.</p>';
  } else {
    filtered.forEach(p => {
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <img src="${p.url}" alt="${p.title}" loading="lazy">
        <div class="card-body">
          <div class="card-title">${p.title}</div>
          <div class="card-meta"><span>${p.category}</span> <span>By: ${p.submitterName}</span></div>
        </div>`;
      card.onclick = () => window.openViewer(p);
      gallery.appendChild(card);
    });
  }
}
document.getElementById('searchInput').oninput = renderGallery;

// ==========================================
// FUNGSI CEK LIMIT (3X PER HARI)
// ==========================================
function checkDailyLimit() {
  const today = new Date();
  today.setHours(0, 0, 0, 0); 
  
  const myUploadsToday = allPhotos.filter(p => {
    if(p.deviceId !== deviceId) return false;
    const docDate = p.timestamp ? p.timestamp.toDate() : new Date();
    return docDate >= today;
  });

  return myUploadsToday.length >= 3;
}

// ==========================================
// FUNGSI KOMPRESI GAMBAR (CANVAS)
// ==========================================
function compressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const MAX_SIZE = 800;

        if (width > height && width > MAX_SIZE) {
          height *= MAX_SIZE / width;
          width = MAX_SIZE;
        } else if (height > MAX_SIZE) {
          width *= MAX_SIZE / height;
          height = MAX_SIZE;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const base64Str = canvas.toDataURL('image/jpeg', 0.6);
        resolve(base64Str);
      };
    };
    reader.onerror = (error) => reject(error);
  });
}

// ==========================================
// SUBMIT FORM
// ==========================================
function populateCategoryDropdown() {
  const approvedPhotos = allPhotos.filter(p => p.status === 'approved');
  const uniqueCats = [...new Set(approvedPhotos.map(p => p.category))];
  const select = document.getElementById('subCategory');
  select.innerHTML = '<option value="">-- Pilih Kategori --</option>';
  uniqueCats.forEach(cat => select.innerHTML += `<option value="${cat}">${cat}</option>`);
}

document.getElementById('submitForm').onsubmit = async (e) => {
  e.preventDefault();
  
  if(checkDailyLimit()) {
      alert("Gagal kirim! Lu udah kirim 3 foto hari ini.");
      window.closeModal('submitModal');
      return;
  }

  const name = document.getElementById('subName').value.trim();
  const title = document.getElementById('subTitle').value.trim();
  const desc = document.getElementById('subDesc').value.trim();
  const catSelect = document.getElementById('subCategory').value;
  const catNew = document.getElementById('subNewCategory').value.trim();
  const category = (catNew || catSelect || "UMUM").toUpperCase();
  const fileInput = document.getElementById('subFile');
  const btn = document.getElementById('btnSubmitForm');

  localStorage.setItem('maginti_submitter_name', name);

  try {
    btn.disabled = true;
    btn.innerHTML = "<i class='bx bx-loader bx-spin'></i> Memproses & Mengunggah...";

    const file = fileInput.files[0];
    const compressedBase64 = await compressImage(file);

    await addDoc(collection(db, "submissions"), {
      submitterName: name,
      deviceId: deviceId,
      title: title,
      description: desc,
      category: category,
      url: compressedBase64,
      status: 'pending',
      timestamp: serverTimestamp()
    });

    alert("Pengajuan berhasil dikirim! Silakan tunggu konfirmasi Admin.");
    window.closeModal('submitModal');
    document.getElementById('submitForm').reset();
  } catch(err) { 
    console.error(err);
    alert("Gagal upload! Pastikan Rules Firestore di-set allow read, write."); 
  } finally { 
    btn.disabled = false; 
    btn.innerHTML = "<i class='bx bx-cloud-upload'></i> Ajukan Foto"; 
  }
};

// ==========================================
// ADMIN DASHBOARD
// ==========================================
window.openAdminLogin = () => {
  const pwd = prompt("Masukkan Password Admin Dashboard:");
  if(pwd === "admin123") { 
    window.closeModal('menuModal');
    window.openModal('adminModal');
    renderAdminDashboard();
  } else if (pwd !== null) alert("Password Salah!");
};

function renderAdminDashboard() {
  const pending = allPhotos.filter(p => p.status === 'pending');
  const list = document.getElementById('adminList');
  
  if(pending.length === 0) {
    list.innerHTML = '<p style="color:var(--text-muted); font-size:14px; text-align:center;">Tidak ada pengajuan baru.</p>';
    return;
  }
  
  list.innerHTML = '';
  pending.forEach(p => {
    list.innerHTML += `
      <div class="admin-item">
        <img src="${p.url}" onclick='window.openViewer(${JSON.stringify(p).replace(/"/g, "&quot;")})' style="cursor:pointer;" title="Klik untuk lihat">
        <div class="admin-info">
          <h4>${p.title}</h4>
          <p>Oleh: ${p.submitterName} | Kat: ${p.category}</p>
        </div>
        <div class="admin-actions">
          <button class="btn-acc" onclick="handleModeration('${p.id}', 'approved', '${p.deviceId}', '${p.title}')"><i class='bx bx-check'></i></button>
          <button class="btn-rej" onclick="handleModeration('${p.id}', 'rejected', '${p.deviceId}', '${p.title}')"><i class='bx bx-x'></i></button>
        </div>
      </div>
    `;
  });
}

window.handleModeration = async (docId, status, targetDeviceId, title) => {
  try {
    await updateDoc(doc(db, "submissions", docId), { status: status });
    
    await addDoc(collection(db, "notifications"), {
      deviceId: targetDeviceId,
      message: `Pengajuan foto "${title}" Anda telah ${status === 'approved' ? 'DITERIMA' : 'DITOLAK'} oleh Admin.`,
      status: status,
      read: false,
      timestamp: serverTimestamp()
    });
  } catch(err) {
    console.error(err);
    alert("Terjadi kesalahan saat update status!");
  }
};

// ==========================================
// VIEWER
// ==========================================
window.openViewer = (data) => {
  document.getElementById('viewerImage').src = data.url;
  document.getElementById('viewerTitle').innerText = data.title;
  document.getElementById('viewerDesc').innerText = data.description || '';
  
  const btnLink = document.getElementById('btnDownloadLink');
  btnLink.href = data.url;
  btnLink.download = data.title.replace(/\s+/g, '_') + '.jpg';
  
  document.getElementById('btnShare').onclick = () => {
    const text = `Lihat dokumentasi "${data.title}" di Maginti Album!`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };
  
  window.openModal('viewerModal');
};
