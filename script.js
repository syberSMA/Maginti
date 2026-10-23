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
// IDENTITAS & GLOBAL STATE
// ==========================================
let deviceId = localStorage.getItem('maginti_device_id');
if (!deviceId) {
  deviceId = 'device_' + Math.random().toString(36).substr(2, 9);
  localStorage.setItem('maginti_device_id', deviceId);
}
let allPhotos = [];
let currentCategory = "all";
const defaultIcons = { "TK MAGINTI": "bx-book-reader", "SD NEGERI 1": "bx-building", "SMP NEGERI 1": "bx-buildings", "SMA NEGERI 2": "bx-graduation", "SUNSET SANRES": "bx-sun", "STREET VIEW": "bx-map-alt" };

// ==========================================
// CUSTOM UI (TOAST & MODALS) - Pengganti bawaan browser
// ==========================================
window.showToast = (msg, type = "success") => {
  const toast = document.getElementById('toast');
  document.getElementById('toastMsg').innerText = msg;
  document.getElementById('toastIcon').className = type === 'success' ? 'bx bx-check-circle' : 'bx bx-x-circle';
  toast.className = `toast show ${type}`;
  setTimeout(() => toast.classList.remove('show'), 3500);
};

window.openModal = (id) => { document.getElementById(id).classList.add('active'); document.body.classList.add('no-scroll'); }
window.closeModal = (id) => { document.getElementById(id).classList.remove('active'); document.body.classList.remove('no-scroll'); }
window.openInfo = () => { closeModal('menuModal'); openModal('infoModal'); }

// ==========================================
// LOGIKA INPUT FORM (TOGGLE TABS)
// ==========================================
const btnTabFile = document.getElementById('btnTabFile');
const btnTabUrl = document.getElementById('btnTabUrl');
const containerFile = document.getElementById('inputFileContainer');
const containerUrl = document.getElementById('inputUrlContainer');
const subFile = document.getElementById('subFile');
const subUrl = document.getElementById('subUrl');

btnTabFile.onclick = () => {
  btnTabFile.classList.add('active'); btnTabUrl.classList.remove('active');
  containerFile.style.display = 'block'; containerUrl.style.display = 'none';
  subFile.required = true; subUrl.required = false;
};
btnTabUrl.onclick = () => {
  btnTabUrl.classList.add('active'); btnTabFile.classList.remove('active');
  containerUrl.style.display = 'block'; containerFile.style.display = 'none';
  subUrl.required = true; subFile.required = false;
};

// ==========================================
// CUSTOM DROPDOWN SELECT
// ==========================================
const catWrapper = document.getElementById('customCatWrapper');
const catBtn = document.getElementById('customCatBtn');
const catOptions = document.getElementById('customCatOptions');
const catText = document.getElementById('customCatText');
const hiddenInputCat = document.getElementById('subCategory');

catBtn.onclick = () => catWrapper.classList.toggle('open');
document.addEventListener('click', (e) => {
  if (!catWrapper.contains(e.target)) catWrapper.classList.remove('open');
});

function populateCustomDropdown() {
  const approvedPhotos = allPhotos.filter(p => p.status === 'approved');
  const uniqueCats = [...new Set(approvedPhotos.map(p => p.category))];
  catOptions.innerHTML = `<div class="custom-option" data-value="">-- Pilih Kategori --</div>`;
  uniqueCats.forEach(cat => {
    catOptions.innerHTML += `<div class="custom-option" data-value="${cat}">${cat}</div>`;
  });
  
  document.querySelectorAll('.custom-option').forEach(opt => {
    opt.onclick = () => {
      catText.innerText = opt.innerText;
      hiddenInputCat.value = opt.getAttribute('data-value');
      catWrapper.classList.remove('open');
    };
  });
}

// ==========================================
// OPTIMASI GAMBAR
// ==========================================
window.getOptimizedUrl = (url) => {
  if (!url) return "";
  if (url.startsWith("http") && url.includes("catbox.moe")) {
    return `https://wsrv.nl/?url=${encodeURIComponent(url)}&output=webp&w=400&q=70`;
  }
  return url; 
};

window.handleImgError = (img, rawUrl) => {
  if (!img.dataset.retried) {
    img.dataset.retried = "true";
    img.src = rawUrl; 
  } else {
    img.parentElement.classList.remove('skeleton');
    img.src = 'data:image/svg+xml;charset=UTF-8,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400"%3E%3Crect width="400" height="400" fill="%231e293b"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-size="16" fill="%2394a3b8" font-family="sans-serif"%3EGagal Memuat%3C/text%3E%3C/svg%3E';
    img.classList.add('loaded');
  }
};

// ==========================================
// BINDINGS & LISTENERS
// ==========================================
document.getElementById('btnMenu').onclick = () => openModal('menuModal');
document.getElementById('btnNotif').onclick = () => { openModal('notifModal'); document.getElementById('notifBadge').style.display = 'none'; }

document.getElementById('btnAddPhoto').onclick = () => { 
  if(checkDailyLimit()) {
      window.showToast("Limit Tercapai! Maksimal 3 upload per hari.", "error");
      return;
  }
  populateCustomDropdown();
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
// FIRESTORE LISTENER (GALERI)
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
      
      // LOGIKA BADGE LABEL DEV/USER
      let badgeHtml = '';
      const nameL = p.submitterName.toLowerCase();
      if (nameL === 'admin system' || nameL === 'dev upload') {
        badgeHtml = `<span class="badge badge-dev"><i class='bx bxs-check-shield'></i> Dev Upload</span>`;
      } else {
        badgeHtml = `<span class="badge badge-user"><i class='bx bxs-user'></i> By: ${p.submitterName}</span>`;
      }

      card.innerHTML = `
        <div class="img-wrapper skeleton">
          <img src="${window.getOptimizedUrl(p.url)}" loading="lazy" decoding="async" alt="${p.title}" 
               onload="this.parentElement.classList.remove('skeleton'); this.classList.add('loaded');"
               onerror="window.handleImgError(this, '${p.url}')">
        </div>
        <div class="card-body">
          <div class="card-title">${p.title}</div>
          <div class="badge-container">
            <span class="badge-cat">${p.category}</span>
            ${badgeHtml}
          </div>
        </div>`;
      card.onclick = () => window.openViewer(p);
      gallery.appendChild(card);
    });
  }
}
document.getElementById('searchInput').oninput = renderGallery;

// ==========================================
// SUBMIT FORM & COMPRESS (URL/FILE)
// ==========================================
function checkDailyLimit() {
  const today = new Date(); today.setHours(0, 0, 0, 0); 
  return allPhotos.filter(p => p.deviceId === deviceId && (p.timestamp ? p.timestamp.toDate() : new Date()) >= today).length >= 3;
}

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width, h = img.height;
        if (w > h && w > 800) { h *= 800 / w; w = 800; } 
        else if (h > 800) { w *= 800 / h; h = 800; }
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.6));
      };
    };
    reader.onerror = error => reject(error);
  });
}

document.getElementById('submitForm').onsubmit = async (e) => {
  e.preventDefault();
  
  if(checkDailyLimit()) {
      window.showToast("Gagal kirim! Limit harian 3 foto.", "error");
      window.closeModal('submitModal');
      return;
  }

  const name = document.getElementById('subName').value.trim();
  const title = document.getElementById('subTitle').value.trim();
  const desc = document.getElementById('subDesc').value.trim();
  const catSelect = hiddenInputCat.value;
  const catNew = document.getElementById('subNewCategory').value.trim();
  const category = (catNew || catSelect || "UMUM").toUpperCase();
  const btn = document.getElementById('btnSubmitForm');
  localStorage.setItem('maginti_submitter_name', name);

  let finalUrl = "";
  const isFile = document.getElementById('btnTabFile').classList.contains('active');

  try {
    btn.disabled = true;
    btn.innerHTML = "<i class='bx bx-loader bx-spin'></i> Memproses...";

    if (isFile) {
      if (!subFile.files[0]) throw new Error("Pilih file terlebih dahulu!");
      finalUrl = await compressImage(subFile.files[0]);
    } else {
      if (!subUrl.value.trim()) throw new Error("Masukkan Link URL yang valid!");
      finalUrl = subUrl.value.trim();
    }

    await addDoc(collection(db, "submissions"), {
      submitterName: name, deviceId: deviceId, title: title, description: desc,
      category: category, url: finalUrl, status: 'pending', timestamp: serverTimestamp()
    });

    window.showToast("Berhasil diajukan! Menunggu Acc.", "success");
    window.closeModal('submitModal');
    document.getElementById('submitForm').reset();
    hiddenInputCat.value = ""; document.getElementById('customCatText').innerText = "-- Pilih Kategori --";
  } catch(err) { 
    console.error(err);
    window.showToast(err.message || "Gagal upload, cek koneksi!", "error");
  } finally { 
    btn.disabled = false; 
    btn.innerHTML = "<i class='bx bx-cloud-upload'></i> Ajukan Foto"; 
  }
};

// ==========================================
// ADMIN CUSTOM PROMPT & DASHBOARD
// ==========================================
window.triggerAdminLogin = () => {
  window.closeModal('menuModal');
  document.getElementById('promptInput').value = "";
  window.openModal('promptModal');
};

document.getElementById('btnPromptSubmit').onclick = () => {
  const pwd = document.getElementById('promptInput').value;
  if(pwd === "admin123") { 
    window.closeModal('promptModal');
    window.openModal('adminModal');
    renderAdminDashboard();
  } else {
    window.showToast("Password Salah!", "error");
  }
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
      deviceId: targetDeviceId, message: `Pengajuan "${title}" telah ${status === 'approved' ? 'DITERIMA' : 'DITOLAK'}.`,
      status: status, read: false, timestamp: serverTimestamp()
    });
    window.showToast("Aksi berhasil dieksekusi", "success");
  } catch(err) {
    window.showToast("Error update status!", "error");
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
  btnLink.href = data.url; btnLink.download = data.title.replace(/\s+/g, '_') + '.jpg';
  
  document.getElementById('btnShare').onclick = () => {
    const text = `Lihat dokumentasi "${data.title}" di Maginti Album!`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };
  window.openModal('viewerModal');
};
